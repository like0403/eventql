/**
  This file is part of the "FnordMetric" project
    Copyright (c) 2014 Laura Schlimmer
    Copyright (c) 2014 Paul Asmuth, Google Inc.

  FnordMetric is free software: you can redistribute it and/or modify it under
  the terms of the GNU General Public License v3.0. You should have received a
  copy of the GNU General Public License along with this program. If not, see
  <http://www.gnu.org/licenses/>.
**/
var ModalComponent = function() {
  this.createdCallback = function() {
    var base = this;

    //customisable
    this.closeElems = [
      this.querySelector("fn-modal-close-icon"), this.parentNode
    ];

    this.closeElems.forEach(function(elem) {
      if (elem) {
        elem.onclick = function() {
          base.close();
        }
      }
    });

    this.onclick = function(e) {
      e.stopPropagation();
    };
  };

  this.keyListener;

  this.listener = function(e) {
    //ESC
    if (e.keyCode == 27) {
      this.close();
    }
  };

  this.show = function() {
    var dimmer = this.parentNode;
    if (dimmer && dimmer.tagName == 'FN-MODAL-DIMMER') {
      dimmer.setAttribute('data-active', 'active');
    } else {
      this.setAttribute('data-active', 'active');
    }

    //place modal
    var height = this.getBoundingClientRect().height;
    var mtop = ((window.innerHeight - height) / 4);
    this.style.marginTop = mtop + "px";

    var _this = this;
    this.keyListener = this.listener.bind(this);
    document.addEventListener('keyup', _this.keyListener, false);
  };

  this.close = function() {
    var dimmer = this.parentNode;
    if (dimmer) {
      dimmer.removeAttribute('data-active');
    } else {
      this.removeAttribute('data-active');
    }

    var _this = this;
    document.removeEventListener('keyup', _this.keyListener, false);
  };
};

var proto = Object.create(HTMLElement.prototype);
ModalComponent.apply(proto);
document.registerElement("fn-modal", { prototype: proto });