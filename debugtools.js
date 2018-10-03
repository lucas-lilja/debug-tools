/*
* Copyright (c) 2018 Lucas Lilja
* Licensed MPL 2
 */

+function ($) {
    'use strict';

    $.fn.findJQueryCacheOrphans = function () {
        if (this.length < 1) return;
        findJQueryCacheOrphans(this);
    };

    $.fn.removeOrphans = function () {
        if (this.length < 1) return;
        removeOrphans(this);
    };

    var optionsCookieName = "debuggingToolsOptions";
    var defaultConsoleChanged = false;
    var logXHREnabled = false;
    var defaultOptions = {
        persist: false,
        preserveLog: false,
        preserveError: false,
        preserveTrace: false,
        preserveInfo: false,
        preserveWarn: false,
        preserveDir: false,
        logXhr: false,
        changeDefaultLogging: false,
        debug: ["localhost", "127.0.0.1"].indexOf(window.location.hostname) !== -1
    }, options = $.extend({}, defaultOptions), origXhrOpen, origLog, origError, origWarn, origInfo, origTrace, origDir, callable;

    var cookie = getCookie(optionsCookieName);
    if (cookie) {
        resolveOptions(JSON.parse(cookie));
    }

    function setOption(name, value) {
        if (defaultOptions.hasOwnProperty(name)) {
            options[name] = !!value;
        } else {
            console.warn("No option " + name + " exist.");
        }
    }

    function resolveOptions() {
        var args = arguments.length;
        if (args === 1) {
            if ($.isPlainObject(arguments[0])) {
                $.each(arguments[0], setOption);
            } else {
                console.warn("Wrong argument type. Should be object.")
            }
        } else if (args === 2) {
            if (typeof arguments[0] === 'string' && typeof arguments[1] === 'boolean') {
                setOption(arguments[0], arguments[1]);
            } else {
                console.warn("Wrong argument type. First must be a string and second must be boolean.")
            }
        } else {
            console.warn("Wrong number of arguments.")
        }
        newOptions();
    }

    function newOptions() {
        if (options.logXhr === true) {
            enableXHRLogging();
        } else {
            disableXHRLogging();
        }
        if (options.changeDefaultLogging === true) {
            enableDefaultConsole();
        } else {
            disableDefaultConsole();
        }
        if (options.persist) {
            setCookie(optionsCookieName, options);
        } else {
            deleteCookie(optionsCookieName);
        }
    }

    function setCookie(name, value, expire) {
        if (!expire || !$.isNumeric(expire)) {
            expire = 7 * 24 * 60 * 60 * 1000
        }
        var d = new Date();
        d.setTime(d.getTime() + (expire));
        var expires = "expires=" + d.toUTCString();
        document.cookie = name + "=" + encodeURIComponent(JSON.stringify(value)) + ";" + expires + ";path=/";
    }

    function getCookie(name) {
        var value = null;
        $.each(decodeURIComponent(document.cookie).split("; "), function (idx, val) {
            if (val.startsWith(name + "=")) {
                value = val.split("=")[1];
                return false;
            }
        });
        return value;
    }

    function deleteCookie(name) {
        document.cookie = name + '=; expires=Thu, 01-Jan-70 00:00:01 GMT; Path=/';
    }

    function enableDefaultConsole() {
        if (!defaultConsoleChanged) {
            defaultConsoleChanged = true;
            origLog = console.log;
            console.log = log;
            origError = console.error;
            console.error = error;
            origWarn = console.warn;
            console.warn = warn;
            origInfo = console.info;
            console.info = info;
            origTrace = console.trace;
            console.trace = trace;
            origDir = console.dir;
            console.dir = dir;
        }
    }

    function disableDefaultConsole() {
        if (defaultConsoleChanged) {
            defaultConsoleChanged = false;
            console.log = origLog;
            console.error = origError;
            console.warn = origWarn;
            console.info = origInfo;
            console.trace = origTrace;
            console.dir = origDir;
        }
    }

    function preserve() {
        var newArguments = [];
        $.each(arguments, function (key, argument) {
            if (typeof argument === 'object') {
                argument = $.extend(true, {}, argument);
            } else if ($.isArray(argument)) {
                argument = $.extend(true, [], argument);
            }
            newArguments[key] = argument;
        });
        return newArguments;
    }

    function enableXHRLogging() {
        if (!logXHREnabled) {
            logXHREnabled = true;
            origXhrOpen = XMLHttpRequest.prototype.open;
            XMLHttpRequest.prototype.open = function () {
                var start = new Date().getTime();
                log("XHR " + arguments[0] + " to: " + arguments[1]);
                this.addEventListener('error', function () {
                    var time = getTime(new Date().getTime() - start);
                    log("Error from " + this.responseURL + " with status " + this.status + " (in " + time + "): " + this.responseText);
                    debug(this);
                });
                this.addEventListener('load', function () {
                    var time = getTime(new Date().getTime() - start);
                    log("Response from " + this.responseURL + " with status " + this.status + " (in " + time + "): " + this.responseText);
                    debug(this);
                });
                origXhrOpen.apply(this, arguments);
            };
        }
    }

    function disableXHRLogging() {
        if (logXHREnabled) {
            logXHREnabled = false;
            XMLHttpRequest.prototype.open = origXhrOpen;
        }
    }

    function getTime(time) {
        var timeString;
        if(time < 1000) {
            timeString = time + "ms";
        } else if(time < 2 * 60 * 1000) {
            timeString = (time / 1000) + "s";
        } else if(time < 2 * 60 * 60 * 1000) {
            timeString = (time / 60 * 1000) + "m";
        } else if(time < 2 * 24 * 60 * 60 * 1000) {
            timeString = (time / 60 * 60 * 1000) + "h";
        } else {
            timeString = (time / 24 * 60 * 60 * 1000) + "d";
        }
        return timeString;
    }

    function findJQueryCacheOrphans($scope) {
        $scope = $scope ? $scope : document;
        var i = 0;
        var orphans = [];
        $.each($.cache, function(key, entry) {
            if (entry.handle && entry.handle.elem && document !== entry.handle.elem && !$.contains($scope, entry.handle.elem)) {
                var orphan = $(entry.handle.elem);
                orphans.push(orphan);
                i++;
                debug("Found orphaned element!", orphan);
            }
        });
        debug(i + " orphaned elements found!");
        return $(orphans);
    }

    function removeOrphans($orphans) {
        var i = 0;
        $.each($orphans, function(idx, orphan) {
            var $orphan = $(orphan);
            try {
                $('body').append($orphan);
                $orphan.off();
                $orphan.remove();
                $orphan = null;
                i++;
            } catch (e) {
                console.error(e);
            }
        });
        debug(i + " orphaned elements removed!");
    }

    function log() {
        (options.changeDefaultLogging ? origLog : console.log).apply(console, options.preserveLog ? preserve.apply(this, arguments) : arguments);
    }

    function error() {
        (options.changeDefaultLogging ? origError : console.error).apply(console, options.preserveError ? preserve.apply(this, arguments) : arguments);
    }

    function info() {
        (options.changeDefaultLogging ? origInfo : console.info).apply(console, options.preserveInfo ? preserve.apply(this, arguments) : arguments);
    }

    function warn() {
        (options.changeDefaultLogging ? origWarn : console.warn).apply(console, options.preserveWarn ? preserve.apply(this, arguments) : arguments);
    }

    function trace() {
        (options.changeDefaultLogging ? origTrace : console.trace).apply(console, options.preserveTrace ? preserve.apply(this, arguments) : arguments);
    }

    function dir() {
        (options.changeDefaultLogging ? origDir : console.dir).apply(console, options.preserveDir ? preserve.apply(this, arguments) : arguments);
    }

    function debug() {
        if(options.debug) {
            (options.changeDefaultLogging ? origLog : console.log).apply(console, preserve.apply(this, arguments));
        }
    }

    callable = {
        log: function () {
            log.apply(this, arguments);
            return this;
        },

        error: function () {
            error.apply(this, arguments);
            return this;
        },

        info: function () {
            info.apply(this, arguments);
            return this;
        },

        warn: function () {
            warn.apply(this, arguments);
            return this;
        },

        trace: function () {
            trace.apply(this, arguments);
            return this;
        },

        dir: function () {
            dir.apply(this, arguments);
            return this;
        },

        setCookie: function (name, value, expire) {
            setCookie(name, value, expire);
            return this;
        },

        getCookie: function (name) {
            return getCookie(name);
        },

        setOptions: function () {
            resolveOptions.apply(this, arguments);
            return this;
        },

        persist: function (enabled) {
            resolveOptions("persist", enabled);
            return this;
        },

        setPreserveAll: function (enabled) {
            resolveOptions({
                preserveLog: enabled,
                preserveError: enabled,
                preserveTrace: enabled,
                preserveInfo: enabled,
                preserveWarn: enabled,
                preserveDir: enabled
            });
            return this;
        },

        enableDefaultConsole: function () {
            resolveOptions("changeDefaultLogging", true);
            return this;
        },

        disableDefaultConsole: function () {
            resolveOptions("changeDefaultLogging", false);
            return this;
        },

        enableXHRLogging: function () {
            resolveOptions("logXhr", true);
            return this;
        },

        disableXHRLogging: function () {
            resolveOptions("logXhr", false);
            return this;
        },

        findJQueryCacheOrphans: function($scope) {
            return findJQueryCacheOrphans($scope);
        },

        removeOrphans: function($orphans) {
            removeOrphans($orphans);
        }
    };

    $.debugTools = function () {
        if (arguments.length !== 0) {
            resolveOptions.apply(this, arguments);
        }
        return callable;
    };

}(jQuery);