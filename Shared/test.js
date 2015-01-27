'use strict'

var test = {};
test.list = null;
test.appWin = null;

test.SMmain = function(mounts) {
  chrome.app.window.create('_modules/gpcckkmippodnppallflahfabmeilgjg/window.html', {
    'bounds': {
      'width': 400,
      'height': 500
    }
  }, function(win) {
    test.appWin = win.contentWindow.window;
    test.appWin.window.onload = function() {
      test.list = test.appWin.document.getElementById("mounts");
      mounts.forEach(function(mount) {
        var item = test.appWin.document.createElement("li");
        item.appendChild(test.appWin.document.createTextNode(mount.path));
        test.list.appendChild(item);
      });
    }
  });
}

test.registerSelf = function() {
  wash.shared_modules.register("test", this);
  wash.shared_modules.needsMounts("test");
}

test.handleAddMount = function(mount) {
  var item = test.appWin.document.createElement("li");
  item.appendChild(test.appWin.document.createTextNode(mount.path));
  test.list.appendChild(item);
}

test.handleRemoveMount = function(mount) {
  for (var i = 0; i < test.list.children.length; i++) {
    var child = test.list.children[i];
    if (child.textContent == mount.path) {
      test.list.removeChild(child);
      break;
    }
  }
}

test.isRunning = function() {
  return test.appWin !== null;
}

test.registerSelf();
