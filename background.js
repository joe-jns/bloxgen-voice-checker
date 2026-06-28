// Bloxgen Voice Checker - service worker
// Receives a .ROBLOSECURITY cookie, sets it on .roblox.com, queries Roblox's voice
// API, then clears the cookie. Everything is SERIALIZED because the cookie store is
// global to the profile: two checks running in parallel would clobber each other.

const ROBLOX_URL = "https://www.roblox.com/";
const COOKIE_NAME = ".ROBLOSECURITY";

// Map Roblox age-group translation keys to a short label.
//   Label.AgeGroupOver21 -> 21+   Label.AgeGroup18To20 -> 18-20   Label.AgeGroupUnder13 -> <13
function ageGroupLabel(key) {
  if (!key) return null;
  const m = String(key).replace("Label.AgeGroup", "");
  if (m.startsWith("Over")) return m.slice(4) + "+";
  if (m.startsWith("Under")) return "<" + m.slice(5);
  const r = m.match(/^(\d+)To(\d+)$/);
  if (r) return r[1] + "-" + r[2];
  return m;
}

// --- Queue: one check at a time ---------------------------------------------
let chain = Promise.resolve();
function enqueue(task) {
  const run = chain.then(task, task);
  chain = run.catch(() => {}); // never break the chain
  return run;
}

async function setCookie(value) {
  await chrome.cookies.set({
    url: ROBLOX_URL,
    name: COOKIE_NAME,
    value: value,
    domain: ".roblox.com",
    path: "/",
    secure: true,
    httpOnly: true,
    sameSite: "no_restriction",
    expirationDate: Math.floor(Date.now() / 1000) + 3600
  });
}

async function clearCookie() {
  try {
    await chrome.cookies.remove({ url: ROBLOX_URL, name: COOKIE_NAME });
  } catch (_) {}
}

async function checkVoice(cookie) {
  await setCookie(cookie);
  try {
    // 1) Is the cookie alive? (also gives userId / name)
    const meRes = await fetch("https://users.roblox.com/v1/users/authenticated", {
      credentials: "include",
      cache: "no-store"
    });
    if (meRes.status === 401 || meRes.status === 403) {
      return { ok: true, alive: false };
    }
    if (!meRes.ok) {
      return { ok: false, error: "auth HTTP " + meRes.status };
    }
    const me = await meRes.json();

    // 2) Voice chat status
    const vRes = await fetch("https://voice.roblox.com/v1/settings", {
      credentials: "include",
      cache: "no-store"
    });
    if (!vRes.ok) {
      return { ok: false, error: "voice HTTP " + vRes.status, userId: me.id, name: me.name };
    }
    const v = await vRes.json();

    // 3) Age group (new Roblox age ranges: <13, 13-15, 16-17, 18-20, 21+)
    let ageGroup = null;
    try {
      const aRes = await fetch("https://apis.roblox.com/user-settings-api/v1/account-insights/age-group", {
        credentials: "include",
        cache: "no-store"
      });
      if (aRes.ok) {
        const a = await aRes.json();
        ageGroup = ageGroupLabel(a.ageGroupTranslationKey);
      }
    } catch (_) {}

    return {
      ok: true,
      alive: true,
      voiceEnabled: !!v.isVoiceEnabled,
      verified: !!v.isVerifiedForVoice,
      eligible: !!v.isUserEligible,
      banned: !!v.isBanned,
      denialReason: v.denialReason,
      canVerifyAge: !!v.canVerifyAgeForVoice,
      ageGroup: ageGroup,
      userId: me.id,
      name: me.name
    };
  } catch (e) {
    return { ok: false, error: String(e && e.message ? e.message : e) };
  } finally {
    await clearCookie();
  }
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg && msg.type === "CHECK_VOICE" && typeof msg.cookie === "string") {
    enqueue(() => checkVoice(msg.cookie)).then(sendResponse);
    return true; // async response
  }
});
