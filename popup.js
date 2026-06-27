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
