if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then(function (regs) {
    for (var i = 0; i < regs.length; i++) regs[i].unregister();
  }).catch(function () {});
  if ('caches' in window) {
    caches.keys().then(function (keys) {
      for (var i = 0; i < keys.length; i++) caches.delete(keys[i]);
    }).catch(function () {});
  }
}
