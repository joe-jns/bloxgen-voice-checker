// Popup: "Check all visible accounts"
const checkAllBtn = document.getElementById("checkAll");

checkAllBtn.addEventListener("click", async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || !/^https:\/\/bloxgen\.net\/dashboard\/generator/.test(tab.url || "")) {
    checkAllBtn.textContent = "Open the Generator page first";
    setTimeout(() => (checkAllBtn.textContent = "Check all visible accounts"), 2000);
    return;
  }
  chrome.tabs.sendMessage(tab.id, { type: "CHECK_ALL" });
  window.close();
});

const clearBtn = document.getElementById("clear");
clearBtn.addEventListener("click", () => {
  if (clearBtn.dataset.armed) {
    chrome.storage.local.set({ voiceCache: {} });
    clearBtn.textContent = "Cleared";
    setTimeout(() => { delete clearBtn.dataset.armed; clearBtn.textContent = "Clear checked results"; }, 1200);
  } else {
    clearBtn.dataset.armed = "1";
    clearBtn.textContent = "Click again to confirm";
    setTimeout(() => { delete clearBtn.dataset.armed; clearBtn.textContent = "Clear checked results"; }, 3000);
  }
});
