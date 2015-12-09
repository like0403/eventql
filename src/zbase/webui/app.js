var ZBase = (function() {
  var fatal_error = false;
  var current_path;
  var current_route;
  var current_view;
  var previous_path;
  var modules_status = {};
  var modules_waitlist = [];
  var views = {};
  var config;

  /* feature detection */
  var __enable_html5_import = false; // google only technology, not even properly documented :(
  var __enable_html5_templates = ("content" in document.createElement("template"));
  var __enable_html5_importnode = 'importNode' in document;

  try {
    document.importNode(document.createElement('div'));
  } catch (e) {
    __enable_html5_importnode = false;
  }

  var init = function(_config) {
    config = _config;

    console.log(
      ">> Initializing ZBase UI, detected features: " +
      "html5_templates=" + (__enable_html5_templates ? "yes" : "no") + ", " +
      "html5_imports=" + (__enable_html5_import ? "yes" : "no") + ", " +
      "html5_importnode=" + (__enable_html5_importnode ? "yes" : "no"));

    registerPopstateHandler();
    changeNavigation(window.location.pathname + window.location.search);
    renderLayout();
  };

  var getConfig = function() {
    return config;
  };

  var updateConfig = function(new_config) {
    config = new_config;

    renderLayout();
  };

  var showFatalError = function(msg) {
    console.log(">> FATAL ERROR: " + msg);

    if (fatal_error) {
      return;
    }

    showLoader();

    var error_elem = document.createElement("div");
    error_elem.classList.add("zbase_fatal_error");
    error_elem.innerHTML =
        "<span>" +
        "<h1>We're sorry</h1>" +
        "Something went wrong and the application crashed &mdash; please reload the " +
        "page or contact support if the problem persists." +
        "<a href='/a/'>Reload</a>"
        "</span>";

    document.body.appendChild(error_elem);
    fatal_error = true;
    throw msg;
  };

  var showLoader = function() {
    document.getElementById("zbase_main_loader").classList.remove("hidden");
  };

  var hideLoader = function() {
    document.getElementById("zbase_main_loader").classList.add("hidden");
  };

  var registerView = function(view) {
    views[view.name] = view;
  };

  var findRoute = function(full_path) {
    var path = full_path;
    var end = path.indexOf("?");
    if (end >= 0) {
      path = path.substring(0, end);
    }

    for (var i = 0; i < config.routes.length; i++) {
      if (config.routes[i].path_prefix &&
          path.indexOf(config.routes[i].path_prefix) == 0) {
        return config.routes[i];
      }

      if (config.routes[i].path_match == path) {
        return config.routes[i];
      }
    }

    return null;
  };

  /**
   * Navigation
   */
  var registerPopstateHandler = function() {
    window.addEventListener('load', function() {
      setTimeout(function() {
        window.addEventListener('popstate', function(e) {
          e.preventDefault();
          if (e.state && e.state.path) {
            changeNavigation(e.state.path);
          } else {
            //FIXME
            if (window.location.hash.length > 0) {
              return;
            }
            changeNavigation(window.location.pathname + window.location.search);
          }
        }, false);
      }, 0);
    }, false);
  };

  var applyNavigationChange = function() {
    if (current_view && current_view.name == current_route.view) {
      hideLoader();
      current_view.handleNavigationChange(current_path);
      return;
    }

    if (current_view) {
      current_view.unloadView();
      document.getElementById("zbase_viewport").innerHTML = "";
    }

    current_view = views[current_route.view];
    if (!current_view) {
      showFatalError("view not found: " + current_route.view);
      return;
    }

    hideLoader();
    if (config.current_user) {
      HeaderWidget.update(current_path);
      ZBaseMainMenu.update(current_path);
    }

    current_view.loadView({path: current_path, config: config});
  };

  var changeNavigation = function(path) {
    console.log(">> Navigate to: ", path);
    showLoader();

    var route = findRoute(path);
    if (route == null) {
      if (path.indexOf("/a/") == 0 &&
          path.indexOf("/a/dashboards/") == -1 /* HACK remove me once dashboard migration finished */) {
        navigateTo(config.default_route);
      } else {
        window.location.href = path;
      }
      return;
    }

    current_route = route;
    previous_path = current_path;
    current_path = path;

    loadModules(route.modules, function() {
      applyNavigationChange();
    });
  };

  var navigateTo = function(path) {
    history.pushState({path: path}, "", path);
    changeNavigation(path);
  };

  var pushHistoryState = function(path) {
    history.pushState({path: path}, "", path);
  };

  /**
    * Replace current history state with previous one
    **/
  var popHistoryState = function() {
    if (previous_path) {
      history.pushState({path: previous_path}, "", previous_path);
      current_path = previous_path;
    }
  };

  /**
   * Module loading
   */
  var finishModuleDownload = function(module) {
    modules_status[module] = "loaded";
    // fire all finished callbacks
    for (var j = modules_waitlist.length - 1; j >= 0; j--) {
      var entry = modules_waitlist[j];
      for (var i = 0; i < entry.modules.length; i++) {
        if (modules_status[entry.modules[i]] != "loaded") {
          return;
        }
      }

      modules_waitlist.splice(j, 1);
      entry.on_loaded();
    }
  };

  var startModulesDownload = function(modules) {
    modules.forEach(function(module) {
      console.log(">> Loading module: ", module);
      modules_status[module] = "loading";

      window.setTimeout(function() {
        var import_url = "/a/_/m/" + module;

        if (__enable_html5_import) {
          var link = document.createElement('link');
          link.rel = 'import';
          link.href = import_url;
          link.setAttribute("data-module", module);
          link.setAttribute("async", "async");
          link.onerror = function(e) {
            showFatalError("Error while loading module: " + module);
          };

          document.body.appendChild(link);
        } else {
          $.httpGet(import_url, function(http) {
            if (http.status == 200) {
              var dummy = document.createElement("div");
              dummy.innerHTML = http.responseText;
              dummy.style.display = "none";
              document.body.appendChild(dummy);

              var scripts = dummy.getElementsByTagName('script');
              for (var i = 0; i < scripts.length; i++) {
                var script = document.createElement('script');
                script.type = scripts[i].type;
                if (scripts[i].src) {
                  script.src = scripts[i].src;
                } else {
                  script.innerHTML = scripts[i].innerHTML;
                }

                document.head.appendChild(script);
              }
            } else {
              showFatalError("Error while loading module: " + module);
              return;
            }
          });
        }
      }, 0);
    });
  };

  var loadModules = function(modules, on_loaded) {
    // search for modules that have not finished loading
    var unloaded_modules = [];
    modules.forEach(function(module) {
      if (modules_status[module] != "loaded") {
        unloaded_modules.push(module);
      }
    });

    // early exit if all modules are already loded
    if (unloaded_modules.length == 0) {
      on_loaded();
      return;
    }

    // add ourselves to the waitlist
    modules_waitlist.push({
      modules: modules,
      on_loaded: on_loaded
    });

    // search for modules that haven't started downloading yet
    var download_modules = [];
    unloaded_modules.forEach(function(module) {
      if (modules_status[module] != "loading") {
        download_modules.push(module);
      }
    });

    // start downloading missing modules
    startModulesDownload(download_modules);
  };

  function importNodeFallback(node, deep) {
    var a, i, il, doc = document;

    switch (node.nodeType) {

      case document.DOCUMENT_FRAGMENT_NODE:
        var new_node = document.createDocumentFragment();
        while (child = node.firstChild) {
          new_node.appendChild(node);
        }
        return new_node;

      case document.ELEMENT_NODE:
        var new_node = doc.createElementNS(node.namespaceURI, node.nodeName);
        if (node.attributes && node.attributes.length > 0) {
          for (i = 0, il = node.attributes.length; i < il; i++) {
            a = node.attributes[i];
            try {
              new_node.setAttributeNS(
                  a.namespaceURI,
                  a.nodeName,
                  node.getAttribute(a.nodeName));
            } catch (err) {}
          }
        }
        if (deep && node.childNodes && node.childNodes.length > 0) {
          for (i = 0, il = node.childNodes.length; i < il; i++) {
            new_node.appendChild(
                importNodeFallback(node.childNodes[i],
                deep));
          }
        }
        return new_node;

      case document.TEXT_NODE:
      case document.CDATA_SECTION_NODE:
      case document.COMMENT_NODE:
        return doc.createTextNode(node.nodeValue);

    }
  }

  var getTemplate = function(module, template_id) {
    var template_selector = "#" + template_id;

    var template = document.querySelector(template_selector);

    if (!template && __enable_html5_import) {
      var template_import = document.querySelector(
          "link[data-module='" + module + "']");

      if (!template_import) {
        return null;
      }

      template = template_import.import.querySelector(template_selector);
    }

    if (!template && __enable_html5_import) {
      var template_imports = document.querySelectorAll("link[rel='import']");

      for (var i = 0; !template && i < template_imports.length; ++i) {
        template = template_imports[i].import.querySelector(template_selector);
      }
    }

    if (!template) {
      return null;
    }

    var content;
    if (__enable_html5_templates) {
      content = template.content;
    } else {
      content = document.createDocumentFragment();
      var children = template.children;

      for (var j = 0; j < children.length; j++) {
        content.appendChild(children[j].cloneNode(true));
      }
    }

    if (__enable_html5_importnode) {
      return document.importNode(content, true);
    } else {
      return importNodeFallback(content, true);
    }
  };

  var renderLayout = function() {
    var conf = $.getConfig();

    // render footer
    document.getElementById("zbase_build_id").innerHTML = conf.zbase_build_id;
    document.getElementById("zbase_domain").innerHTML = conf.zbase_domain;
    document.getElementById("zbase_footer").classList.remove("hidden");

    // render header and body
    if (conf.current_user) {
      var global_modules = [
        "widgets/zbase-header",
        "widgets/z-search",
        "widgets/z-dropdown",
        "widgets/zbase-main-menu",
        "widgets/z-menu"
      ];

      ZBase.loadModules(global_modules, function() {
        //render header bar
        var header_bar = document.getElementById("zbase_header_bar");
        header_bar.innerHTML = "";
        header_bar.style.display = "block";

        var links = {
          "/a/datastore": "Datastore",
          "/analytics": "Analytics",
          "/docs/": "Documentation"
        }
        for (var link in links) {
          var html = "<a href='" + link +
            "' style='font-size: 12px; margin-left: 23px; line-height: 29px; color: ";

          if (link == "/a/datastore") {
            html += "#fff;'";
          } else if (link == "/docs/") {
            html += "#b5cce3;' target='_blank'"
          } else {
            html += "#b5cce3;'"
          }
          html += ">" + links[link] + "</a>"
          header_bar.innerHTML += html;
        }

        HeaderWidget.render();
        ZBaseMainMenu.render(current_path);
      });
    } else {
      document.querySelector("#zbase_header_bar").style.display = "none";
      document.querySelector("#zbase_header").classList.add("hidden");
      document.querySelector("#zbase_main_menu").classList.add("hidden");
    }
  };

  var createNewDocument = function(doc_type) {
    var name;
    var path;

    switch (doc_type) {
      case "sql_query":
        name = "Unnamed SQL Query";
        path = "/a/sql/";
        break;

      case "report":
        name = "Unnamed Report";
        path = "/a/reports/";
        break;

      default:
        $.fatalError();
        return;
    }

    var postdata = $.buildQueryString({
      name: name,
      type: doc_type
    });

    $.httpPost("/api/v1/documents", postdata, function(r) {
      if (r.status == 201) {
        var response = JSON.parse(r.response);
        $.navigateTo(path + response.uuid);
        return;
      } else {
        $.fatalError();
      }
    });
  };

  return {
    init: init,
    loadModules: loadModules,
    moduleReady: finishModuleDownload,
    registerView: registerView,
    navigateTo: navigateTo,
    popHistoryState: popHistoryState,
    pushHistoryState: pushHistoryState,
    getConfig: getConfig,
    updateConfig: updateConfig,
    getTemplate: getTemplate,
    fatalError: showFatalError,
    showLoader: showLoader,
    hideLoader: hideLoader,
    createNewDocument: createNewDocument
  };
})();

var $ = function(selector, elem) {
  if (!elem) {
    elem = document;
  }

  return elem.querySelector(selector);
};

$.navigateTo = ZBase.navigateTo;
$.getConfig = ZBase.getConfig;
$.getTemplate = ZBase.getTemplate;
$.fatalError = ZBase.fatalError;
$.showLoader = ZBase.showLoader;
$.hideLoader = ZBase.hideLoader;
$.createNewDocument = ZBase.createNewDocument;
$.popHistoryState = ZBase.popHistoryState;
$.pushHistoryState = ZBase.pushHistoryState;

$.handleLinks = function(elem) {
  var click_fn = (function() {
    return function(e) {
      var href = this.getAttribute("href");

      if (href && href.indexOf("/a/") == 0) {
        $.navigateTo(href);
        e.preventDefault();
        return false;
      } else {
        return true;
      }
    };
  })();

  var elems = elem.querySelectorAll("a");
  for (var i = 0; i < elems.length; ++i) {
    elems[i].addEventListener("click", click_fn);
  }
};

$.onClick = function(elem, fn) {
  elem.addEventListener("click", function(e) {
    e.preventDefault();
    e.stopPropagation();
    fn.call(this, e);
    return false;
  });
};

$.stopEventPropagation = function(elem, event_name) {
  elem.addEventListener(event_name, function(e) {
    e.stopPropagation();
  }, false);
};

$.httpPost = function(url, request, callback) {
  var http = new XMLHttpRequest();
  http.open("POST", url, true);
  var start = (new Date()).getTime();
  http.send(request);

  http.onreadystatechange = function() {
    if (http.readyState == 4) {
      var end = (new Date()).getTime();
      var duration = end - start;
      callback(http, duration);
    }
  }
};

$.httpGet = function(url, callback) {
  var http = new XMLHttpRequest();
  http.open("GET", url, true);
  http.send();

  var base = this;
  http.onreadystatechange = function() {
    if (http.readyState == 4) {
      callback(http);
    }
  }
};

$.buildQueryString = function(params) {
  var qs = "";

  for (var key in params) {
    var value = params[key];
    qs += encodeURIComponent(key) + "=" + encodeURIComponent(value) + "&";
  }

  return qs;
}

$.replaceViewport = function(new_content) {
  var viewport = document.getElementById("zbase_viewport");
  viewport.innerHTML = "";
  viewport.appendChild(new_content);
}

$.replaceContent = function(elem, new_content) {
  elem.innerHTML = "";
  elem.appendChild(new_content);
}

$.escapeHTML = function(str) {
  if (str == undefined || str == null || str.length == 0) {
    return "";
  }
  var div = document.createElement('div');
  div.appendChild(document.createTextNode(str));
  return div.innerHTML;
};

$.nl2br = function(str) {
  return str.replace(/\n/g, "<br />");
};

$.nl2p = function(str) {
  var lines = str.split("\n\n");

  return lines.map(function(s) {
    return "<p>" + s.replace(/\n/g, "<br />")  + "</p>";
  }).join("\n");
};

$.wrapText = function(str) {
  var new_str = "";
  var partlen = 10;

  for (var pos = 0; pos < str.length; pos += partlen) {
    if (pos > 0) new_str += "&#8203;"
    new_str += $.escapeHTML(str.substr(pos, partlen));
  }

  return new_str;
}

$.uuid = function() {
  function s4() {
    return Math.floor((1 + Math.random()) * 0x10000)
      .toString(16)
      .substring(1);
  }
  return s4() + s4() + '-' + s4() + '-' + s4() + '-' +
    s4() + '-' + s4() + s4() + s4();
};

document.getTemplateByID = function(template_name) {
  return $.getTemplate("", template_name);
};

// FIXME move somwhere else...
/**
 * @license
 * Copyright (c) 2014 The Polymer Project Authors. All rights reserved.
 * This code may only be used under the BSD style license found at http://polymer.github.io/LICENSE.txt
 * The complete set of authors may be found at http://polymer.github.io/AUTHORS.txt
 * The complete set of contributors may be found at http://polymer.github.io/CONTRIBUTORS.txt
 * Code distributed by Google as part of the polymer project is also
 * subject to an additional IP rights grant found at http://polymer.github.io/PATENTS.txt
 */
// @version 0.7.12
window.WebComponents=window.WebComponents||{},function(e){var t=e.flags||{},n="webcomponents-lite.js",r=document.querySelector('script[src*="'+n+'"]');if(!t.noOpts){if(location.search.slice(1).split("&").forEach(function(e){var n,r=e.split("=");r[0]&&(n=r[0].match(/wc-(.+)/))&&(t[n[1]]=r[1]||!0)}),r)for(var o,i=0;o=r.attributes[i];i++)"src"!==o.name&&(t[o.name]=o.value||!0);if(t.log){var a=t.log.split(",");t.log={},a.forEach(function(e){t.log[e]=!0})}else t.log={}}t.shadow=t.shadow||t.shadowdom||t.polyfill,t.shadow="native"===t.shadow?!1:t.shadow||!HTMLElement.prototype.createShadowRoot,t.register&&(window.CustomElements=window.CustomElements||{flags:{}},window.CustomElements.flags.register=t.register),e.flags=t}(window.WebComponents),function(e){"use strict";function t(e){return void 0!==h[e]}function n(){s.call(this),this._isInvalid=!0}function r(e){return""==e&&n.call(this),e.toLowerCase()}function o(e){var t=e.charCodeAt(0);return t>32&&127>t&&-1==[34,35,60,62,63,96].indexOf(t)?e:encodeURIComponent(e)}function i(e){var t=e.charCodeAt(0);return t>32&&127>t&&-1==[34,35,60,62,96].indexOf(t)?e:encodeURIComponent(e)}function a(e,a,s){function c(e){g.push(e)}var d=a||"scheme start",u=0,l="",_=!1,w=!1,g=[];e:for(;(e[u-1]!=f||0==u)&&!this._isInvalid;){var b=e[u];switch(d){case"scheme start":if(!b||!m.test(b)){if(a){c("Invalid scheme.");break e}l="",d="no scheme";continue}l+=b.toLowerCase(),d="scheme";break;case"scheme":if(b&&v.test(b))l+=b.toLowerCase();else{if(":"!=b){if(a){if(f==b)break e;c("Code point not allowed in scheme: "+b);break e}l="",u=0,d="no scheme";continue}if(this._scheme=l,l="",a)break e;t(this._scheme)&&(this._isRelative=!0),d="file"==this._scheme?"relative":this._isRelative&&s&&s._scheme==this._scheme?"relative or authority":this._isRelative?"authority first slash":"scheme data"}break;case"scheme data":"?"==b?(this._query="?",d="query"):"#"==b?(this._fragment="#",d="fragment"):f!=b&&"	"!=b&&"\n"!=b&&"\r"!=b&&(this._schemeData+=o(b));break;case"no scheme":if(s&&t(s._scheme)){d="relative";continue}c("Missing scheme."),n.call(this);break;case"relative or authority":if("/"!=b||"/"!=e[u+1]){c("Expected /, got: "+b),d="relative";continue}d="authority ignore slashes";break;case"relative":if(this._isRelative=!0,"file"!=this._scheme&&(this._scheme=s._scheme),f==b){this._host=s._host,this._port=s._port,this._path=s._path.slice(),this._query=s._query,this._username=s._username,this._password=s._password;break e}if("/"==b||"\\"==b)"\\"==b&&c("\\ is an invalid code point."),d="relative slash";else if("?"==b)this._host=s._host,this._port=s._port,this._path=s._path.slice(),this._query="?",this._username=s._username,this._password=s._password,d="query";else{if("#"!=b){var y=e[u+1],E=e[u+2];("file"!=this._scheme||!m.test(b)||":"!=y&&"|"!=y||f!=E&&"/"!=E&&"\\"!=E&&"?"!=E&&"#"!=E)&&(this._host=s._host,this._port=s._port,this._username=s._username,this._password=s._password,this._path=s._path.slice(),this._path.pop()),d="relative path";continue}this._host=s._host,this._port=s._port,this._path=s._path.slice(),this._query=s._query,this._fragment="#",this._username=s._username,this._password=s._password,d="fragment"}break;case"relative slash":if("/"!=b&&"\\"!=b){"file"!=this._scheme&&(this._host=s._host,this._port=s._port,this._username=s._username,this._password=s._password),d="relative path";continue}"\\"==b&&c("\\ is an invalid code point."),d="file"==this._scheme?"file host":"authority ignore slashes";break;case"authority first slash":if("/"!=b){c("Expected '/', got: "+b),d="authority ignore slashes";continue}d="authority second slash";break;case"authority second slash":if(d="authority ignore slashes","/"!=b){c("Expected '/', got: "+b);continue}break;case"authority ignore slashes":if("/"!=b&&"\\"!=b){d="authority";continue}c("Expected authority, got: "+b);break;case"authority":if("@"==b){_&&(c("@ already seen."),l+="%40"),_=!0;for(var L=0;L<l.length;L++){var M=l[L];if("	"!=M&&"\n"!=M&&"\r"!=M)if(":"!=M||null!==this._password){var T=o(M);null!==this._password?this._password+=T:this._username+=T}else this._password="";else c("Invalid whitespace in authority.")}l=""}else{if(f==b||"/"==b||"\\"==b||"?"==b||"#"==b){u-=l.length,l="",d="host";continue}l+=b}break;case"file host":if(f==b||"/"==b||"\\"==b||"?"==b||"#"==b){2!=l.length||!m.test(l[0])||":"!=l[1]&&"|"!=l[1]?0==l.length?d="relative path start":(this._host=r.call(this,l),l="",d="relative path start"):d="relative path";continue}"	"==b||"\n"==b||"\r"==b?c("Invalid whitespace in file host."):l+=b;break;case"host":case"hostname":if(":"!=b||w){if(f==b||"/"==b||"\\"==b||"?"==b||"#"==b){if(this._host=r.call(this,l),l="",d="relative path start",a)break e;continue}"	"!=b&&"\n"!=b&&"\r"!=b?("["==b?w=!0:"]"==b&&(w=!1),l+=b):c("Invalid code point in host/hostname: "+b)}else if(this._host=r.call(this,l),l="",d="port","hostname"==a)break e;break;case"port":if(/[0-9]/.test(b))l+=b;else{if(f==b||"/"==b||"\\"==b||"?"==b||"#"==b||a){if(""!=l){var N=parseInt(l,10);N!=h[this._scheme]&&(this._port=N+""),l=""}if(a)break e;d="relative path start";continue}"	"==b||"\n"==b||"\r"==b?c("Invalid code point in port: "+b):n.call(this)}break;case"relative path start":if("\\"==b&&c("'\\' not allowed in path."),d="relative path","/"!=b&&"\\"!=b)continue;break;case"relative path":if(f!=b&&"/"!=b&&"\\"!=b&&(a||"?"!=b&&"#"!=b))"	"!=b&&"\n"!=b&&"\r"!=b&&(l+=o(b));else{"\\"==b&&c("\\ not allowed in relative path.");var O;(O=p[l.toLowerCase()])&&(l=O),".."==l?(this._path.pop(),"/"!=b&&"\\"!=b&&this._path.push("")):"."==l&&"/"!=b&&"\\"!=b?this._path.push(""):"."!=l&&("file"==this._scheme&&0==this._path.length&&2==l.length&&m.test(l[0])&&"|"==l[1]&&(l=l[0]+":"),this._path.push(l)),l="","?"==b?(this._query="?",d="query"):"#"==b&&(this._fragment="#",d="fragment")}break;case"query":a||"#"!=b?f!=b&&"	"!=b&&"\n"!=b&&"\r"!=b&&(this._query+=i(b)):(this._fragment="#",d="fragment");break;case"fragment":f!=b&&"	"!=b&&"\n"!=b&&"\r"!=b&&(this._fragment+=b)}u++}}function s(){this._scheme="",this._schemeData="",this._username="",this._password=null,this._host="",this._port="",this._path=[],this._query="",this._fragment="",this._isInvalid=!1,this._isRelative=!1}function c(e,t){void 0===t||t instanceof c||(t=new c(String(t))),this._url=e,s.call(this);var n=e.replace(/^[ \t\r\n\f]+|[ \t\r\n\f]+$/g,"");a.call(this,n,null,t)}var d=!1;if(!e.forceJURL)try{var u=new URL("b","http://a");u.pathname="c%20d",d="http://a/c%20d"===u.href}catch(l){}if(!d){var h=Object.create(null);h.ftp=21,h.file=0,h.gopher=70,h.http=80,h.https=443,h.ws=80,h.wss=443;var p=Object.create(null);p["%2e"]=".",p[".%2e"]="..",p["%2e."]="..",p["%2e%2e"]="..";var f=void 0,m=/[a-zA-Z]/,v=/[a-zA-Z0-9\+\-\.]/;c.prototype={toString:function(){return this.href},get href(){if(this._isInvalid)return this._url;var e="";return(""!=this._username||null!=this._password)&&(e=this._username+(null!=this._password?":"+this._password:"")+"@"),this.protocol+(this._isRelative?"//"+e+this.host:"")+this.pathname+this._query+this._fragment},set href(e){s.call(this),a.call(this,e)},get protocol(){return this._scheme+":"},set protocol(e){this._isInvalid||a.call(this,e+":","scheme start")},get host(){return this._isInvalid?"":this._port?this._host+":"+this._port:this._host},set host(e){!this._isInvalid&&this._isRelative&&a.call(this,e,"host")},get hostname(){return this._host},set hostname(e){!this._isInvalid&&this._isRelative&&a.call(this,e,"hostname")},get port(){return this._port},set port(e){!this._isInvalid&&this._isRelative&&a.call(this,e,"port")},get pathname(){return this._isInvalid?"":this._isRelative?"/"+this._path.join("/"):this._schemeData},set pathname(e){!this._isInvalid&&this._isRelative&&(this._path=[],a.call(this,e,"relative path start"))},get search(){return this._isInvalid||!this._query||"?"==this._query?"":this._query},set search(e){!this._isInvalid&&this._isRelative&&(this._query="?","?"==e[0]&&(e=e.slice(1)),a.call(this,e,"query"))},get hash(){return this._isInvalid||!this._fragment||"#"==this._fragment?"":this._fragment},set hash(e){this._isInvalid||(this._fragment="#","#"==e[0]&&(e=e.slice(1)),a.call(this,e,"fragment"))},get origin(){var e;if(this._isInvalid||!this._scheme)return"";switch(this._scheme){case"data":case"file":case"javascript":case"mailto":return"null"}return e=this.host,e?this._scheme+"://"+e:""}};var _=e.URL;_&&(c.createObjectURL=function(e){return _.createObjectURL.apply(_,arguments)},c.revokeObjectURL=function(e){_.revokeObjectURL(e)}),e.URL=c}}(this),"undefined"==typeof WeakMap&&!function(){var e=Object.defineProperty,t=Date.now()%1e9,n=function(){this.name="__st"+(1e9*Math.random()>>>0)+(t++ +"__")};n.prototype={set:function(t,n){var r=t[this.name];return r&&r[0]===t?r[1]=n:e(t,this.name,{value:[t,n],writable:!0}),this},get:function(e){var t;return(t=e[this.name])&&t[0]===e?t[1]:void 0},"delete":function(e){var t=e[this.name];return t&&t[0]===e?(t[0]=t[1]=void 0,!0):!1},has:function(e){var t=e[this.name];return t?t[0]===e:!1}},window.WeakMap=n}(),function(e){function t(e){b.push(e),g||(g=!0,m(r))}function n(e){return window.ShadowDOMPolyfill&&window.ShadowDOMPolyfill.wrapIfNeeded(e)||e}function r(){g=!1;var e=b;b=[],e.sort(function(e,t){return e.uid_-t.uid_});var t=!1;e.forEach(function(e){var n=e.takeRecords();o(e),n.length&&(e.callback_(n,e),t=!0)}),t&&r()}function o(e){e.nodes_.forEach(function(t){var n=v.get(t);n&&n.forEach(function(t){t.observer===e&&t.removeTransientObservers()})})}function i(e,t){for(var n=e;n;n=n.parentNode){var r=v.get(n);if(r)for(var o=0;o<r.length;o++){var i=r[o],a=i.options;if(n===e||a.subtree){var s=t(a);s&&i.enqueue(s)}}}}function a(e){this.callback_=e,this.nodes_=[],this.records_=[],this.uid_=++y}function s(e,t){this.type=e,this.target=t,this.addedNodes=[],this.removedNodes=[],this.previousSibling=null,this.nextSibling=null,this.attributeName=null,this.attributeNamespace=null,this.oldValue=null}function c(e){var t=new s(e.type,e.target);return t.addedNodes=e.addedNodes.slice(),t.removedNodes=e.removedNodes.slice(),t.previousSibling=e.previousSibling,t.nextSibling=e.nextSibling,t.attributeName=e.attributeName,t.attributeNamespace=e.attributeNamespace,t.oldValue=e.oldValue,t}function d(e,t){return E=new s(e,t)}function u(e){return L?L:(L=c(E),L.oldValue=e,L)}function l(){E=L=void 0}function h(e){return e===L||e===E}function p(e,t){return e===t?e:L&&h(e)?L:null}function f(e,t,n){this.observer=e,this.target=t,this.options=n,this.transientObservedNodes=[]}var m,v=new WeakMap;if(/Trident|Edge/.test(navigator.userAgent))m=setTimeout;else if(window.setImmediate)m=window.setImmediate;else{var _=[],w=String(Math.random());window.addEventListener("message",function(e){if(e.data===w){var t=_;_=[],t.forEach(function(e){e()})}}),m=function(e){_.push(e),window.postMessage(w,"*")}}var g=!1,b=[],y=0;a.prototype={observe:function(e,t){if(e=n(e),!t.childList&&!t.attributes&&!t.characterData||t.attributeOldValue&&!t.attributes||t.attributeFilter&&t.attributeFilter.length&&!t.attributes||t.characterDataOldValue&&!t.characterData)throw new SyntaxError;var r=v.get(e);r||v.set(e,r=[]);for(var o,i=0;i<r.length;i++)if(r[i].observer===this){o=r[i],o.removeListeners(),o.options=t;break}o||(o=new f(this,e,t),r.push(o),this.nodes_.push(e)),o.addListeners()},disconnect:function(){this.nodes_.forEach(function(e){for(var t=v.get(e),n=0;n<t.length;n++){var r=t[n];if(r.observer===this){r.removeListeners(),t.splice(n,1);break}}},this),this.records_=[]},takeRecords:function(){var e=this.records_;return this.records_=[],e}};var E,L;f.prototype={enqueue:function(e){var n=this.observer.records_,r=n.length;if(n.length>0){var o=n[r-1],i=p(o,e);if(i)return void(n[r-1]=i)}else t(this.observer);n[r]=e},addListeners:function(){this.addListeners_(this.target)},addListeners_:function(e){var t=this.options;t.attributes&&e.addEventListener("DOMAttrModified",this,!0),t.characterData&&e.addEventListener("DOMCharacterDataModified",this,!0),t.childList&&e.addEventListener("DOMNodeInserted",this,!0),(t.childList||t.subtree)&&e.addEventListener("DOMNodeRemoved",this,!0)},removeListeners:function(){this.removeListeners_(this.target)},removeListeners_:function(e){var t=this.options;t.attributes&&e.removeEventListener("DOMAttrModified",this,!0),t.characterData&&e.removeEventListener("DOMCharacterDataModified",this,!0),t.childList&&e.removeEventListener("DOMNodeInserted",this,!0),(t.childList||t.subtree)&&e.removeEventListener("DOMNodeRemoved",this,!0)},addTransientObserver:function(e){if(e!==this.target){this.addListeners_(e),this.transientObservedNodes.push(e);var t=v.get(e);t||v.set(e,t=[]),t.push(this)}},removeTransientObservers:function(){var e=this.transientObservedNodes;this.transientObservedNodes=[],e.forEach(function(e){this.removeListeners_(e);for(var t=v.get(e),n=0;n<t.length;n++)if(t[n]===this){t.splice(n,1);break}},this)},handleEvent:function(e){switch(e.stopImmediatePropagation(),e.type){case"DOMAttrModified":var t=e.attrName,n=e.relatedNode.namespaceURI,r=e.target,o=new d("attributes",r);o.attributeName=t,o.attributeNamespace=n;var a=e.attrChange===MutationEvent.ADDITION?null:e.prevValue;i(r,function(e){return!e.attributes||e.attributeFilter&&e.attributeFilter.length&&-1===e.attributeFilter.indexOf(t)&&-1===e.attributeFilter.indexOf(n)?void 0:e.attributeOldValue?u(a):o});break;case"DOMCharacterDataModified":var r=e.target,o=d("characterData",r),a=e.prevValue;i(r,function(e){return e.characterData?e.characterDataOldValue?u(a):o:void 0});break;case"DOMNodeRemoved":this.addTransientObserver(e.target);case"DOMNodeInserted":var s,c,h=e.target;"DOMNodeInserted"===e.type?(s=[h],c=[]):(s=[],c=[h]);var p=h.previousSibling,f=h.nextSibling,o=d("childList",e.target.parentNode);o.addedNodes=s,o.removedNodes=c,o.previousSibling=p,o.nextSibling=f,i(e.relatedNode,function(e){return e.childList?o:void 0})}l()}},e.JsMutationObserver=a,e.MutationObserver||(e.MutationObserver=a)}(window),window.HTMLImports=window.HTMLImports||{flags:{}},function(e){function t(e,t){t=t||f,r(function(){i(e,t)},t)}function n(e){return"complete"===e.readyState||e.readyState===_}function r(e,t){if(n(t))e&&e();else{var o=function(){("complete"===t.readyState||t.readyState===_)&&(t.removeEventListener(w,o),r(e,t))};t.addEventListener(w,o)}}function o(e){e.target.__loaded=!0}function i(e,t){function n(){c==d&&e&&e({allImports:s,loadedImports:u,errorImports:l})}function r(e){o(e),u.push(this),c++,n()}function i(e){l.push(this),c++,n()}var s=t.querySelectorAll("link[rel=import]"),c=0,d=s.length,u=[],l=[];if(d)for(var h,p=0;d>p&&(h=s[p]);p++)a(h)?(c++,n()):(h.addEventListener("load",r),h.addEventListener("error",i));else n()}function a(e){return l?e.__loaded||e["import"]&&"loading"!==e["import"].readyState:e.__importParsed}function s(e){for(var t,n=0,r=e.length;r>n&&(t=e[n]);n++)c(t)&&d(t)}function c(e){return"link"===e.localName&&"import"===e.rel}function d(e){var t=e["import"];t?o({target:e}):(e.addEventListener("load",o),e.addEventListener("error",o))}var u="import",l=Boolean(u in document.createElement("link")),h=Boolean(window.ShadowDOMPolyfill),p=function(e){return h?window.ShadowDOMPolyfill.wrapIfNeeded(e):e},f=p(document),m={get:function(){var e=window.HTMLImports.currentScript||document.currentScript||("complete"!==document.readyState?document.scripts[document.scripts.length-1]:null);return p(e)},configurable:!0};Object.defineProperty(document,"_currentScript",m),Object.defineProperty(f,"_currentScript",m);var v=/Trident/.test(navigator.userAgent),_=v?"complete":"interactive",w="readystatechange";l&&(new MutationObserver(function(e){for(var t,n=0,r=e.length;r>n&&(t=e[n]);n++)t.addedNodes&&s(t.addedNodes)}).observe(document.head,{childList:!0}),function(){if("loading"===document.readyState)for(var e,t=document.querySelectorAll("link[rel=import]"),n=0,r=t.length;r>n&&(e=t[n]);n++)d(e)}()),t(function(e){window.HTMLImports.ready=!0,window.HTMLImports.readyTime=(new Date).getTime();var t=f.createEvent("CustomEvent");t.initCustomEvent("HTMLImportsLoaded",!0,!0,e),f.dispatchEvent(t)}),e.IMPORT_LINK_TYPE=u,e.useNative=l,e.rootDocument=f,e.whenReady=t,e.isIE=v}(window.HTMLImports),function(e){var t=[],n=function(e){t.push(e)},r=function(){t.forEach(function(t){t(e)})};e.addModule=n,e.initializeModules=r}(window.HTMLImports),window.HTMLImports.addModule(function(e){var t=/(url\()([^)]*)(\))/g,n=/(@import[\s]+(?!url\())([^;]*)(;)/g,r={resolveUrlsInStyle:function(e,t){var n=e.ownerDocument,r=n.createElement("a");return e.textContent=this.resolveUrlsInCssText(e.textContent,t,r),e},resolveUrlsInCssText:function(e,r,o){var i=this.replaceUrls(e,o,r,t);return i=this.replaceUrls(i,o,r,n)},replaceUrls:function(e,t,n,r){return e.replace(r,function(e,r,o,i){var a=o.replace(/["']/g,"");return n&&(a=new URL(a,n).href),t.href=a,a=t.href,r+"'"+a+"'"+i})}};e.path=r}),window.HTMLImports.addModule(function(e){var t={async:!0,ok:function(e){return e.status>=200&&e.status<300||304===e.status||0===e.status},load:function(n,r,o){var i=new XMLHttpRequest;return(e.flags.debug||e.flags.bust)&&(n+="?"+Math.random()),i.open("GET",n,t.async),i.addEventListener("readystatechange",function(e){if(4===i.readyState){var n=i.getResponseHeader("Location"),a=null;if(n)var a="/"===n.substr(0,1)?location.origin+n:n;r.call(o,!t.ok(i)&&i,i.response||i.responseText,a)}}),i.send(),i},loadDocument:function(e,t,n){this.load(e,t,n).responseType="document"}};e.xhr=t}),window.HTMLImports.addModule(function(e){var t=e.xhr,n=e.flags,r=function(e,t){this.cache={},this.onload=e,this.oncomplete=t,this.inflight=0,this.pending={}};r.prototype={addNodes:function(e){this.inflight+=e.length;for(var t,n=0,r=e.length;r>n&&(t=e[n]);n++)this.require(t);this.checkDone()},addNode:function(e){this.inflight++,this.require(e),this.checkDone()},require:function(e){var t=e.src||e.href;e.__nodeUrl=t,this.dedupe(t,e)||this.fetch(t,e)},dedupe:function(e,t){if(this.pending[e])return this.pending[e].push(t),!0;return this.cache[e]?(this.onload(e,t,this.cache[e]),this.tail(),!0):(this.pending[e]=[t],!1)},fetch:function(e,r){if(n.load&&console.log("fetch",e,r),e)if(e.match(/^data:/)){var o=e.split(","),i=o[0],a=o[1];a=i.indexOf(";base64")>-1?atob(a):decodeURIComponent(a),setTimeout(function(){this.receive(e,r,null,a)}.bind(this),0)}else{var s=function(t,n,o){this.receive(e,r,t,n,o)}.bind(this);t.load(e,s)}else setTimeout(function(){this.receive(e,r,{error:"href must be specified"},null)}.bind(this),0)},receive:function(e,t,n,r,o){this.cache[e]=r;for(var i,a=this.pending[e],s=0,c=a.length;c>s&&(i=a[s]);s++)this.onload(e,i,r,n,o),this.tail();this.pending[e]=null},tail:function(){--this.inflight,this.checkDone()},checkDone:function(){this.inflight||this.oncomplete()}},e.Loader=r}),window.HTMLImports.addModule(function(e){var t=function(e){this.addCallback=e,this.mo=new MutationObserver(this.handler.bind(this))};t.prototype={handler:function(e){for(var t,n=0,r=e.length;r>n&&(t=e[n]);n++)"childList"===t.type&&t.addedNodes.length&&this.addedNodes(t.addedNodes)},addedNodes:function(e){this.addCallback&&this.addCallback(e);for(var t,n=0,r=e.length;r>n&&(t=e[n]);n++)t.children&&t.children.length&&this.addedNodes(t.children)},observe:function(e){this.mo.observe(e,{childList:!0,subtree:!0})}},e.Observer=t}),window.HTMLImports.addModule(function(e){function t(e){return"link"===e.localName&&e.rel===u}function n(e){var t=r(e);return"data:text/javascript;charset=utf-8,"+encodeURIComponent(t)}function r(e){return e.textContent+o(e)}function o(e){var t=e.ownerDocument;t.__importedScripts=t.__importedScripts||0;var n=e.ownerDocument.baseURI,r=t.__importedScripts?"-"+t.__importedScripts:"";return t.__importedScripts++,"\n//# sourceURL="+n+r+".js\n"}function i(e){var t=e.ownerDocument.createElement("style");return t.textContent=e.textContent,a.resolveUrlsInStyle(t),t}var a=e.path,s=e.rootDocument,c=e.flags,d=e.isIE,u=e.IMPORT_LINK_TYPE,l="link[rel="+u+"]",h={documentSelectors:l,importsSelectors:[l,"link[rel=stylesheet]:not([type])","style:not([type])","script:not([type])",'script[type="application/javascript"]','script[type="text/javascript"]'].join(","),map:{link:"parseLink",script:"parseScript",style:"parseStyle"},dynamicElements:[],parseNext:function(){var e=this.nextToParse();e&&this.parse(e)},parse:function(e){if(this.isParsed(e))return void(c.parse&&console.log("[%s] is already parsed",e.localName));var t=this[this.map[e.localName]];t&&(this.markParsing(e),t.call(this,e))},parseDynamic:function(e,t){this.dynamicElements.push(e),t||this.parseNext()},markParsing:function(e){c.parse&&console.log("parsing",e),this.parsingElement=e},markParsingComplete:function(e){e.__importParsed=!0,this.markDynamicParsingComplete(e),e.__importElement&&(e.__importElement.__importParsed=!0,this.markDynamicParsingComplete(e.__importElement)),this.parsingElement=null,c.parse&&console.log("completed",e)},markDynamicParsingComplete:function(e){var t=this.dynamicElements.indexOf(e);t>=0&&this.dynamicElements.splice(t,1)},parseImport:function(e){if(e["import"]=e.__doc,window.HTMLImports.__importsParsingHook&&window.HTMLImports.__importsParsingHook(e),e["import"]&&(e["import"].__importParsed=!0),this.markParsingComplete(e),e.dispatchEvent(e.__resource&&!e.__error?new CustomEvent("load",{bubbles:!1}):new CustomEvent("error",{bubbles:!1})),e.__pending)for(var t;e.__pending.length;)t=e.__pending.shift(),t&&t({target:e});this.parseNext()},parseLink:function(e){t(e)?this.parseImport(e):(e.href=e.href,this.parseGeneric(e))},parseStyle:function(e){var t=e;e=i(e),t.__appliedElement=e,e.__importElement=t,this.parseGeneric(e)},parseGeneric:function(e){this.trackElement(e),this.addElementToDocument(e)},rootImportForElement:function(e){for(var t=e;t.ownerDocument.__importLink;)t=t.ownerDocument.__importLink;return t},addElementToDocument:function(e){var t=this.rootImportForElement(e.__importElement||e);t.parentNode.insertBefore(e,t)},trackElement:function(e,t){var n=this,r=function(o){e.removeEventListener("load",r),e.removeEventListener("error",r),t&&t(o),n.markParsingComplete(e),n.parseNext()};if(e.addEventListener("load",r),e.addEventListener("error",r),d&&"style"===e.localName){var o=!1;if(-1==e.textContent.indexOf("@import"))o=!0;else if(e.sheet){o=!0;for(var i,a=e.sheet.cssRules,s=a?a.length:0,c=0;s>c&&(i=a[c]);c++)i.type===CSSRule.IMPORT_RULE&&(o=o&&Boolean(i.styleSheet))}o&&setTimeout(function(){e.dispatchEvent(new CustomEvent("load",{bubbles:!1}))})}},parseScript:function(t){var r=document.createElement("script");r.__importElement=t,r.src=t.src?t.src:n(t),e.currentScript=t,this.trackElement(r,function(t){r.parentNode&&r.parentNode.removeChild(r),e.currentScript=null}),this.addElementToDocument(r)},nextToParse:function(){return this._mayParse=[],!this.parsingElement&&(this.nextToParseInDoc(s)||this.nextToParseDynamic())},nextToParseInDoc:function(e,n){if(e&&this._mayParse.indexOf(e)<0){this._mayParse.push(e);for(var r,o=e.querySelectorAll(this.parseSelectorsForNode(e)),i=0,a=o.length;a>i&&(r=o[i]);i++)if(!this.isParsed(r))return this.hasResource(r)?t(r)?this.nextToParseInDoc(r.__doc,r):r:void 0}return n},nextToParseDynamic:function(){return this.dynamicElements[0]},parseSelectorsForNode:function(e){var t=e.ownerDocument||e;return t===s?this.documentSelectors:this.importsSelectors},isParsed:function(e){return e.__importParsed},needsDynamicParsing:function(e){return this.dynamicElements.indexOf(e)>=0},hasResource:function(e){return t(e)&&void 0===e.__doc?!1:!0}};e.parser=h,e.IMPORT_SELECTOR=l}),window.HTMLImports.addModule(function(e){function t(e){return n(e,a)}function n(e,t){return"link"===e.localName&&e.getAttribute("rel")===t}function r(e){return!!Object.getOwnPropertyDescriptor(e,"baseURI")}function o(e,t){var n=document.implementation.createHTMLDocument(a);n._URL=t;var o=n.createElement("base");o.setAttribute("href",t),n.baseURI||r(n)||Object.defineProperty(n,"baseURI",{value:t});var i=n.createElement("meta");return i.setAttribute("charset","utf-8"),n.head.appendChild(i),n.head.appendChild(o),n.body.innerHTML=e,window.HTMLTemplateElement&&HTMLTemplateElement.bootstrap&&HTMLTemplateElement.bootstrap(n),n}var i=e.flags,a=e.IMPORT_LINK_TYPE,s=e.IMPORT_SELECTOR,c=e.rootDocument,d=e.Loader,u=e.Observer,l=e.parser,h={documents:{},documentPreloadSelectors:s,importsPreloadSelectors:[s].join(","),loadNode:function(e){p.addNode(e)},loadSubtree:function(e){var t=this.marshalNodes(e);p.addNodes(t)},marshalNodes:function(e){return e.querySelectorAll(this.loadSelectorsForNode(e))},loadSelectorsForNode:function(e){var t=e.ownerDocument||e;return t===c?this.documentPreloadSelectors:this.importsPreloadSelectors},loaded:function(e,n,r,a,s){if(i.load&&console.log("loaded",e,n),n.__resource=r,n.__error=a,t(n)){var c=this.documents[e];void 0===c&&(c=a?null:o(r,s||e),c&&(c.__importLink=n,this.bootDocument(c)),this.documents[e]=c),n.__doc=c}l.parseNext()},bootDocument:function(e){this.loadSubtree(e),this.observer.observe(e),l.parseNext()},loadedAll:function(){l.parseNext()}},p=new d(h.loaded.bind(h),h.loadedAll.bind(h));if(h.observer=new u,!document.baseURI){var f={get:function(){var e=document.querySelector("base");return e?e.href:window.location.href},configurable:!0};Object.defineProperty(document,"baseURI",f),Object.defineProperty(c,"baseURI",f)}e.importer=h,e.importLoader=p}),window.HTMLImports.addModule(function(e){var t=e.parser,n=e.importer,r={added:function(e){for(var r,o,i,a,s=0,c=e.length;c>s&&(a=e[s]);s++)r||(r=a.ownerDocument,o=t.isParsed(r)),i=this.shouldLoadNode(a),i&&n.loadNode(a),this.shouldParseNode(a)&&o&&t.parseDynamic(a,i)},shouldLoadNode:function(e){return 1===e.nodeType&&o.call(e,n.loadSelectorsForNode(e))},shouldParseNode:function(e){return 1===e.nodeType&&o.call(e,t.parseSelectorsForNode(e))}};n.observer.addCallback=r.added.bind(r);var o=HTMLElement.prototype.matches||HTMLElement.prototype.matchesSelector||HTMLElement.prototype.webkitMatchesSelector||HTMLElement.prototype.mozMatchesSelector||HTMLElement.prototype.msMatchesSelector}),function(e){function t(){window.HTMLImports.importer.bootDocument(o)}var n=e.initializeModules,r=e.isIE;if(!e.useNative){r&&"function"!=typeof window.CustomEvent&&(window.CustomEvent=function(e,t){t=t||{};var n=document.createEvent("CustomEvent");return n.initCustomEvent(e,Boolean(t.bubbles),Boolean(t.cancelable),t.detail),n.preventDefault=function(){Object.defineProperty(this,"defaultPrevented",{get:function(){return!0}})},n},window.CustomEvent.prototype=window.Event.prototype),n();var o=e.rootDocument;"complete"===document.readyState||"interactive"===document.readyState&&!window.attachEvent?t():document.addEventListener("DOMContentLoaded",t)}}(window.HTMLImports),window.CustomElements=window.CustomElements||{flags:{}},function(e){var t=e.flags,n=[],r=function(e){n.push(e)},o=function(){n.forEach(function(t){t(e)})};e.addModule=r,e.initializeModules=o,e.hasNative=Boolean(document.registerElement),e.isIE=/Trident/.test(navigator.userAgent),e.useNative=!t.register&&e.hasNative&&!window.ShadowDOMPolyfill&&(!window.HTMLImports||window.HTMLImports.useNative)}(window.CustomElements),window.CustomElements.addModule(function(e){function t(e,t){n(e,function(e){return t(e)?!0:void r(e,t)}),r(e,t)}function n(e,t,r){var o=e.firstElementChild;if(!o)for(o=e.firstChild;o&&o.nodeType!==Node.ELEMENT_NODE;)o=o.nextSibling;for(;o;)t(o,r)!==!0&&n(o,t,r),o=o.nextElementSibling;return null}function r(e,n){for(var r=e.shadowRoot;r;)t(r,n),r=r.olderShadowRoot}function o(e,t){i(e,t,[])}function i(e,t,n){if(e=window.wrap(e),!(n.indexOf(e)>=0)){n.push(e);for(var r,o=e.querySelectorAll("link[rel="+a+"]"),s=0,c=o.length;c>s&&(r=o[s]);s++)r["import"]&&i(r["import"],t,n);t(e)}}var a=window.HTMLImports?window.HTMLImports.IMPORT_LINK_TYPE:"none";e.forDocumentTree=o,e.forSubtree=t}),window.CustomElements.addModule(function(e){function t(e,t){return n(e,t)||r(e,t)}function n(t,n){return e.upgrade(t,n)?!0:void(n&&a(t))}function r(e,t){g(e,function(e){return n(e,t)?!0:void 0})}function o(e){L.push(e),E||(E=!0,setTimeout(i))}function i(){E=!1;for(var e,t=L,n=0,r=t.length;r>n&&(e=t[n]);n++)e();L=[]}function a(e){y?o(function(){s(e)}):s(e)}function s(e){e.__upgraded__&&!e.__attached&&(e.__attached=!0,e.attachedCallback&&e.attachedCallback())}function c(e){d(e),g(e,function(e){d(e)})}function d(e){y?o(function(){u(e)}):u(e)}function u(e){e.__upgraded__&&e.__attached&&(e.__attached=!1,e.detachedCallback&&e.detachedCallback())}function l(e){for(var t=e,n=window.wrap(document);t;){if(t==n)return!0;t=t.parentNode||t.nodeType===Node.DOCUMENT_FRAGMENT_NODE&&t.host}}function h(e){if(e.shadowRoot&&!e.shadowRoot.__watched){w.dom&&console.log("watching shadow-root for: ",e.localName);for(var t=e.shadowRoot;t;)m(t),t=t.olderShadowRoot}}function p(e,n){if(w.dom){var r=n[0];if(r&&"childList"===r.type&&r.addedNodes&&r.addedNodes){for(var o=r.addedNodes[0];o&&o!==document&&!o.host;)o=o.parentNode;var i=o&&(o.URL||o._URL||o.host&&o.host.localName)||"";i=i.split("/?").shift().split("/").pop()}console.group("mutations (%d) [%s]",n.length,i||"")}var a=l(e);n.forEach(function(e){"childList"===e.type&&(M(e.addedNodes,function(e){e.localName&&t(e,a)}),M(e.removedNodes,function(e){e.localName&&c(e)}))}),w.dom&&console.groupEnd()}function f(e){for(e=window.wrap(e),e||(e=window.wrap(document));e.parentNode;)e=e.parentNode;var t=e.__observer;t&&(p(e,t.takeRecords()),i())}function m(e){if(!e.__observer){var t=new MutationObserver(p.bind(this,e));t.observe(e,{childList:!0,subtree:!0}),e.__observer=t}}function v(e){e=window.wrap(e),w.dom&&console.group("upgradeDocument: ",e.baseURI.split("/").pop());var n=e===window.wrap(document);t(e,n),m(e),w.dom&&console.groupEnd()}function _(e){b(e,v)}var w=e.flags,g=e.forSubtree,b=e.forDocumentTree,y=!window.MutationObserver||window.MutationObserver===window.JsMutationObserver;e.hasPolyfillMutations=y;var E=!1,L=[],M=Array.prototype.forEach.call.bind(Array.prototype.forEach),T=Element.prototype.createShadowRoot;T&&(Element.prototype.createShadowRoot=function(){var e=T.call(this);return window.CustomElements.watchShadow(this),e}),e.watchShadow=h,e.upgradeDocumentTree=_,e.upgradeDocument=v,e.upgradeSubtree=r,e.upgradeAll=t,e.attached=a,e.takeRecords=f}),window.CustomElements.addModule(function(e){function t(t,r){if(!t.__upgraded__&&t.nodeType===Node.ELEMENT_NODE){var o=t.getAttribute("is"),i=e.getRegisteredDefinition(t.localName)||e.getRegisteredDefinition(o);if(i&&(o&&i.tag==t.localName||!o&&!i["extends"]))return n(t,i,r)}}function n(t,n,o){return a.upgrade&&console.group("upgrade:",t.localName),n.is&&t.setAttribute("is",n.is),r(t,n),t.__upgraded__=!0,i(t),o&&e.attached(t),e.upgradeSubtree(t,o),a.upgrade&&console.groupEnd(),t}function r(e,t){Object.__proto__?e.__proto__=t.prototype:(o(e,t.prototype,t["native"]),e.__proto__=t.prototype)}function o(e,t,n){for(var r={},o=t;o!==n&&o!==HTMLElement.prototype;){for(var i,a=Object.getOwnPropertyNames(o),s=0;i=a[s];s++)r[i]||(Object.defineProperty(e,i,Object.getOwnPropertyDescriptor(o,i)),r[i]=1);o=Object.getPrototypeOf(o)}}function i(e){e.createdCallback&&e.createdCallback()}var a=e.flags;e.upgrade=t,e.upgradeWithDefinition=n,e.implementPrototype=r}),window.CustomElements.addModule(function(e){function t(t,r){var c=r||{};if(!t)throw new Error("document.registerElement: first argument `name` must not be empty");if(t.indexOf("-")<0)throw new Error("document.registerElement: first argument ('name') must contain a dash ('-'). Argument provided was '"+String(t)+"'.");if(o(t))throw new Error("Failed to execute 'registerElement' on 'Document': Registration failed for type '"+String(t)+"'. The type name is invalid.");if(d(t))throw new Error("DuplicateDefinitionError: a type with name '"+String(t)+"' is already registered");return c.prototype||(c.prototype=Object.create(HTMLElement.prototype)),c.__name=t.toLowerCase(),c.lifecycle=c.lifecycle||{},c.ancestry=i(c["extends"]),a(c),s(c),n(c.prototype),u(c.__name,c),c.ctor=l(c),c.ctor.prototype=c.prototype,c.prototype.constructor=c.ctor,e.ready&&_(document),c.ctor}function n(e){if(!e.setAttribute._polyfilled){
var t=e.setAttribute;e.setAttribute=function(e,n){r.call(this,e,n,t)};var n=e.removeAttribute;e.removeAttribute=function(e){r.call(this,e,null,n)},e.setAttribute._polyfilled=!0}}function r(e,t,n){e=e.toLowerCase();var r=this.getAttribute(e);n.apply(this,arguments);var o=this.getAttribute(e);this.attributeChangedCallback&&o!==r&&this.attributeChangedCallback(e,r,o)}function o(e){for(var t=0;t<E.length;t++)if(e===E[t])return!0}function i(e){var t=d(e);return t?i(t["extends"]).concat([t]):[]}function a(e){for(var t,n=e["extends"],r=0;t=e.ancestry[r];r++)n=t.is&&t.tag;e.tag=n||e.__name,n&&(e.is=e.__name)}function s(e){if(!Object.__proto__){var t=HTMLElement.prototype;if(e.is){var n=document.createElement(e.tag);t=Object.getPrototypeOf(n)}for(var r,o=e.prototype,i=!1;o;)o==t&&(i=!0),r=Object.getPrototypeOf(o),r&&(o.__proto__=r),o=r;i||console.warn(e.tag+" prototype not found in prototype chain for "+e.is),e["native"]=t}}function c(e){return g(T(e.tag),e)}function d(e){return e?L[e.toLowerCase()]:void 0}function u(e,t){L[e]=t}function l(e){return function(){return c(e)}}function h(e,t,n){return e===M?p(t,n):N(e,t)}function p(e,t){e&&(e=e.toLowerCase()),t&&(t=t.toLowerCase());var n=d(t||e);if(n){if(e==n.tag&&t==n.is)return new n.ctor;if(!t&&!n.is)return new n.ctor}var r;return t?(r=p(e),r.setAttribute("is",t),r):(r=T(e),e.indexOf("-")>=0&&b(r,HTMLElement),r)}function f(e,t){var n=e[t];e[t]=function(){var e=n.apply(this,arguments);return w(e),e}}var m,v=e.isIE,_=e.upgradeDocumentTree,w=e.upgradeAll,g=e.upgradeWithDefinition,b=e.implementPrototype,y=e.useNative,E=["annotation-xml","color-profile","font-face","font-face-src","font-face-uri","font-face-format","font-face-name","missing-glyph"],L={},M="http://www.w3.org/1999/xhtml",T=document.createElement.bind(document),N=document.createElementNS.bind(document);m=Object.__proto__||y?function(e,t){return e instanceof t}:function(e,t){if(e instanceof t)return!0;for(var n=e;n;){if(n===t.prototype)return!0;n=n.__proto__}return!1},f(Node.prototype,"cloneNode"),f(document,"importNode"),v&&!function(){var e=document.importNode;document.importNode=function(){var t=e.apply(document,arguments);if(t.nodeType==t.DOCUMENT_FRAGMENT_NODE){var n=document.createDocumentFragment();return n.appendChild(t),n}return t}}(),document.registerElement=t,document.createElement=p,document.createElementNS=h,e.registry=L,e["instanceof"]=m,e.reservedTagList=E,e.getRegisteredDefinition=d,document.register=document.registerElement}),function(e){function t(){a(window.wrap(document)),window.CustomElements.ready=!0;var e=window.requestAnimationFrame||function(e){setTimeout(e,16)};e(function(){setTimeout(function(){window.CustomElements.readyTime=Date.now(),window.HTMLImports&&(window.CustomElements.elapsed=window.CustomElements.readyTime-window.HTMLImports.readyTime),document.dispatchEvent(new CustomEvent("WebComponentsReady",{bubbles:!0}))})})}var n=e.useNative,r=e.initializeModules,o=e.isIE;if(n){var i=function(){};e.watchShadow=i,e.upgrade=i,e.upgradeAll=i,e.upgradeDocumentTree=i,e.upgradeSubtree=i,e.takeRecords=i,e["instanceof"]=function(e,t){return e instanceof t}}else r();var a=e.upgradeDocumentTree,s=e.upgradeDocument;if(window.wrap||(window.ShadowDOMPolyfill?(window.wrap=window.ShadowDOMPolyfill.wrapIfNeeded,window.unwrap=window.ShadowDOMPolyfill.unwrapIfNeeded):window.wrap=window.unwrap=function(e){return e}),window.HTMLImports&&(window.HTMLImports.__importsParsingHook=function(e){e["import"]&&s(wrap(e["import"]))}),o&&"function"!=typeof window.CustomEvent&&(window.CustomEvent=function(e,t){t=t||{};var n=document.createEvent("CustomEvent");return n.initCustomEvent(e,Boolean(t.bubbles),Boolean(t.cancelable),t.detail),n.preventDefault=function(){Object.defineProperty(this,"defaultPrevented",{get:function(){return!0}})},n},window.CustomEvent.prototype=window.Event.prototype),"complete"===document.readyState||e.flags.eager)t();else if("interactive"!==document.readyState||window.attachEvent||window.HTMLImports&&!window.HTMLImports.ready){var c=window.HTMLImports&&!window.HTMLImports.ready?"HTMLImportsLoaded":"DOMContentLoaded";window.addEventListener(c,t)}else t()}(window.CustomElements),"undefined"==typeof HTMLTemplateElement&&!function(){function e(e){switch(e){case"&":return"&amp;";case"<":return"&lt;";case">":return"&gt;";case" ":return"&nbsp;"}}function t(t){return t.replace(a,e)}var n="template",r=document.implementation.createHTMLDocument("template"),o=!0;HTMLTemplateElement=function(){},HTMLTemplateElement.prototype=Object.create(HTMLElement.prototype),HTMLTemplateElement.decorate=function(e){e.content||(e.content=r.createDocumentFragment());for(var n;n=e.firstChild;)e.content.appendChild(n);if(o)try{Object.defineProperty(e,"innerHTML",{get:function(){for(var e="",n=this.content.firstChild;n;n=n.nextSibling)e+=n.outerHTML||t(n.data);return e},set:function(e){for(r.body.innerHTML=e,HTMLTemplateElement.bootstrap(r);this.content.firstChild;)this.content.removeChild(this.content.firstChild);for(;r.body.firstChild;)this.content.appendChild(r.body.firstChild)},configurable:!0})}catch(i){o=!1}},HTMLTemplateElement.bootstrap=function(e){for(var t,r=e.querySelectorAll(n),o=0,i=r.length;i>o&&(t=r[o]);o++)HTMLTemplateElement.decorate(t)},window.addEventListener("DOMContentLoaded",function(){HTMLTemplateElement.bootstrap(document)});var i=document.createElement;document.createElement=function(){"use strict";var e=i.apply(document,arguments);return"template"==e.localName&&HTMLTemplateElement.decorate(e),e};var a=/[&\u00A0<>]/g}(),function(e){var t=document.createElement("style");t.textContent="body {transition: opacity ease-in 0.2s; } \nbody[unresolved] {opacity: 0; display: block; overflow: hidden; position: relative; } \n";var n=document.querySelector("head");n.insertBefore(t,n.firstChild)}(window.WebComponents);

