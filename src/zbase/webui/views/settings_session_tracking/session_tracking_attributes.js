ZBase.registerView((function() {
  var load = function() {
    $.showLoader();

    var page = $.getTemplate(
        "views/settings_session_tracking",
        "zbase_session_tracking_main_tpl");

    var menu = SettingsMenu();
    menu.render($(".zbase_settings_menu_sidebar", page));

    var content = $.getTemplate(
        "views/settings_session_tracking",
        "zbase_session_tracking_attributes_tpl");
    $(".zbase_settings_menu_content", page).appendChild(content);

    $.httpGet("/api/v1/session_tracking/attributes", function(r) {
      if(r.status == 200) {
        renderAttributes(JSON.parse(r.response).session_attributes);
        //$.handleLinks(page); //call?
      } else {
        $.fatalError();
      }
      $.hideLoader();
    });

    $.onClick($(".add_session_attribute .link", page), function() {
      renderAddAttributePane();
    });

    $.handleLinks(page);
    $.replaceViewport(page);
  };

  var renderAttributes = function(attributes) {
    var tbody = $(".zbase_settings table.attributes tbody");
    var tpl = $.getTemplate(
      "views/settings_session_tracking",
      "zbase_session_tracking_attribute_row_tpl");

    attributes.columns.forEach(function(attr) {
      var html = tpl.cloneNode(true);
      $(".attribute_name", html).innerHTML = attr.name;
      $(".attribute_type", html).innerHTML = attr.type;

      $.onClick($(".icon", html), function() {
        alert("not yet implemented");
      });
      tbody.appendChild(html);
    });
  };

  var renderAddAttributePane = function() {
    var pane = $("table.add_attribute");
    var tpl = $.getTemplate(
        "views/settings_session_tracking",
        "zbase_session_tracking_add_attribute_tpl");

    $("tr td", tpl).style.width = $("table.attributes tr td").offsetWidth + "px";
    pane.innerHTML = "";
    pane.appendChild(tpl);

    pane.classList.remove("hidden");
    $(".add_session_attribute").classList.add("hidden");

    $.onClick($("button[data-action='add-attribute']", pane), function() {
      addAttribute();
    });
  };

  var addAttribute = function() {
    var attribute = {};
    attribute.name = $("table.add_attribute input").value;

    if (attribute.name.length == 0) {
      $("table.add_attribute .error_note").classList.remove("hidden");
      return;
    }

    attribute.type = $("table.add_attribute z-dropdown").getValue();
    alert("POST new attribute");
    hideAddAttributePane();
  }

  var hideAddAttributePane = function() {
    $(".add_session_attribute").classList.remove("hidden");
    $("table.add_attribute").classList.add("hidden");
  };

  return {
    name: "session_tracking_attributes",
    loadView: function(params) { load(); },
    unloadView: function() {},
    handleNavigationChange: load
  };

})());

