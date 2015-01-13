'use strict'

var test = {};
test.SMmain = function() {
  chrome.app.window.create('_modules/gpcckkmippodnppallflahfabmeilgjg/window.html', {
    'bounds': {
      'width': 400,
      'height': 500
    }
  });
}
test.registerSelf = function() {
  wash.shared_modules.register("test", this);
}

test.registerSelf();
