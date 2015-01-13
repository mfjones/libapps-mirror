'use strict'

wash.shared_modules = {};
wash.shared_modules.apps = {};

wash.shared_modules.register = function(appName, app) {
  // Register app and app name
  wash.shared_modules.apps[appName] = app;
}
