(function ($, window, undefined) {
    'use strict';
    var pluginName = 'inputize';

    function format(str, data, fallback) {
        if (typeof data === 'undefined') {
            data = {}
        }
        if (typeof fallback === 'undefined') {
            fallback = '';
        }
        return str.replace(/{{\s*((?:\w+\.?\w+)+)(?:\|(\w+))*\s*}}/g, function(match, key, filter) {
            var value = key
                .split('.')
                .reduce(function(item, k){
                    if (typeof item === 'object' &&
                        item.hasOwnProperty(k)
                        && item[k] !== null)
                        return item[k];
                    return fallback;
                }, data)
            ;
            if (typeof value === 'undefined') {
                return fallback;
            }
            if (typeof filter === 'undefined') {
                return value;
            }
            if (typeof ''[filter] === 'number') {
                return value[filter];
            }
            if (typeof ''[filter] !== 'function') {
                console.log(format('filter {{filter}} is not valid', {filter: filter}));
                return value;
            }
            return value[filter]();
        });
    }

    var Inputize = function(element, options) {
        this.$element = $(element);
        this.init(options);
    };

    Inputize.settings = {
        factory: {
            type: 'text'
        },
        tag: {},
        trigger: 'blur',
        update: function(context, value) {
            context.$element.trigger('success.inputize', [value]);
        },
        success: function(evt, value) {},
        errorMessage: 'Unable to generate the input.',
        placeholder: ''
    };

    Inputize.template = {
        icon: '<i class="overlay-icon fa fa-pencil"></i>',
        tools: '<div class="editable-tools"></div>',
        buttons: '<div class="editable-buttons btn-group"></div>',
        confirmButton: '<button class="btn btn-inputize btn-inputize-confirm"><i class="fa fa-check"></i></button>',
        cancelButton: '<button class="btn btn-inputize btn-inputize-cancel"><i class="fa fa-times"></i></button>',
        errors: '<div class="editable-errors"></div>',
        error: '<div class="editable-error">{{ error }}</div>'
    };

    Inputize.instances = [];
    Inputize.counter = 0;

    Inputize.namespaceEvent = function(ev) {
        return [ev,pluginName].join('.');
    };

    Inputize.prototype.init = function(options) {
        if (typeof options === 'function') {
            options = {update: options};
        }
        this.inputFactory = window.Fence.utils.inputFactory;
        this.active = false;

        this.id = Inputize.counter++;
        Inputize.instances.push(this);

        this.errors = [];

        var dataOptions = {};
        $.each(this.$element.data(), function(key, value) {
            if (Inputize.settings.hasOwnProperty(key)) {
                dataOptions[key] = value;
            }
        });

        this.value = typeof this.$element.data('value') !== 'undefined'?
                     this.$element.data('value') :
                     this.$element.text().trim()
        ;

        this.options = $.extend(
            true,
            {},
            Inputize.settings,
            dataOptions,
            options || {}
        );

        this.setup();
        this.registerEvents();
    };

    Inputize.prototype.setup = function() {
        this.setPlaceholder();
        this.addClasses();
        this.generateIcon();
    };

    Inputize.prototype.setPlaceholder = function() {
        if (! this.hasPlaceholder()) {
            return;
        }
        if (this.$element.text().trim() === '') {
            this.$element.html(this.getPlaceholderMarkup());
        }
    };

    Inputize.prototype.hasPlaceholder = function() {
        return this.options.hasOwnProperty('placeholder') && this.options.placeholder.trim() !== '';
    };

    Inputize.prototype.getPlaceholder = function() {
        if (! this.hasPlaceholder()) {
            return '';
        }
        return this.options.placeholder;
    };

    Inputize.prototype.getPlaceholderMarkup = function() {
        if (! this.hasPlaceholder()) {
            return '';
        }
        return '<span class="placeholder">' + this.options.placeholder + '</span>';
    };

    Inputize.prototype.addClasses = function() {
        this.$element.addClass('editable');
    };

    Inputize.prototype.generateTools = function(callback) {
        var self = this;

        var inputProperties = self.generateInputProperties();
        self.inputFactory(inputProperties, function($input) {
            self.$input = $input;
            self.generateButtons();
            self.generateFeedback();

            self.$tools = $(self.view.render('tools'))
                .append(self.$input)
                .append(self.$buttons)
                .append(self.$errors)
                .insertAfter(self.$element);

            callback();
        });
    };

    Inputize.prototype.generateIcon = function() {
        this.$icon = $(format(Inputize.template.icon));

        this.$icon
            .appendTo(this.$element)
        ;
    };

    Inputize.prototype.setInputFactory = function(inputFactory) {
        this.inputFactory = inputFactory;
    };

    Inputize.prototype.generateInputProperties = function() {
        return $.extend(true, {}, this.options.factory, {value: this.value});
    };

    Inputize.prototype.generateButtons = function() {

        this.$confirmButton = $(format(Inputize.template['confirmButton']));
        this.$cancelButton = $(format(Inputize.template['cancelButton']));

        this.$buttons = $(format(Inputize.template['buttons']))
            .append(this.$confirmButton)
            .append(this.$cancelButton)
        ;
    };

    Inputize.prototype.generateFeedback = function() {
        this.$errors = $(format(Inputize.template['errors']));
    };

    Inputize.prototype.getType = function() {
        try {
            return this.options.factory.type;
        }
        catch (e) {
            return null;
        }
    };

    Inputize.prototype.registerEvents = function() {
        var ev = Inputize.namespaceEvent;
        this.$element.on(ev('click'),   $.proxy(this.handleClick,   this));
        this.$element.on(ev('success'), $.proxy(this.handleSuccess, this));
        this.$element.on(ev('error'),   $.proxy(this.handleError,   this));
    };

    Inputize.prototype.registerUpdateEvents = function() {
        var ev = Inputize.namespaceEvent;
        this.$confirmButton.on(ev('click'), $.proxy(this.handleUpdate,  this));
        this.$cancelButton.on(ev('click'),  $.proxy(this.cancelUpdate,  this));
    };

    Inputize.MIN_TEXTAREA_HEIGHT = 120;

    Inputize.prototype.handleClick = function(evt) {
        var self = this;

        var ev = Inputize.namespaceEvent;
        self.$element.trigger(ev('before-click'), [evt]);

        if (self.$input) {
            self.activateInput();
        } else {
            self.generateTools(function() {
                self.activateInput();
                self.registerUpdateEvents();
            });
        }

        self.$element.trigger(ev('after-click'), [evt]);
    };

    Inputize.prototype.activateInput = function() {
        var height = this.$element.height();

        this.active = true;
        this.cancelOthers();
        this.$tools.show();
        this.$input
            .focus()
            .select();

        if (this.getType() == 'textarea') {
            this.$input.css(
                'height',
                height > Inputize.MIN_TEXTAREA_HEIGHT ? height : Inputize.MIN_TEXTAREA_HEIGHT
            );
        }

        this.$element.hide();

        this.registerState(true);
    };

    Inputize.prototype.cancelOthers = function() {
        var otherInstances = this.getOtherInstances();
        for (var i = 0; i < otherInstances.length; i++) {
            var otherInstance = otherInstances[i];
            if (otherInstance.active) {
                otherInstance.cancelUpdate();
            }
        }
    };

    Inputize.prototype.getOtherInstances = function() {
        var instances = Inputize.instances;
        var otherInstances = [];
        var instanceIndex = -1;
        for (var i = 0; i < instances.length; i++) {
            var instance = instances[i];
            if (instance.id !== this.id) {
                otherInstances.push(instance);
            }
        }

        return otherInstances;
    };

    Inputize.prototype.handleUpdate = function(evt) {
        var value = this.$input.val();

        if (value == this.value) {
            this.cancelUpdate(evt);
            return;
        }

        this.update(value);
    };

    Inputize.prototype.cancelUpdate = function(evt) {
        this.wrapup();
    };

    Inputize.prototype.update = function(value) {
        this.options.update(this, value);
    };

    Inputize.prototype.handleSuccess = function(evt, value, model) {

        if (typeof this.options.success === 'function') {
            this.options.success(evt, value, this.value, model);
        }

        this.value = value;
        this.wrapup();
    };

    Inputize.prototype.handleError = function(evt, errors, transaction) {
        this.setErrors(errors);
    };

    Inputize.prototype.setErrors = function(errors) {
        this.errors = errors;
        this.compileErrors();
    };

    Inputize.prototype.clearErrors = function() {
        this.errors = [];
        this.$tools.removeClass("has-error");
        this.compileErrors();
    };

    Inputize.prototype.addError = function(error) {
        this.errors.push(error);
        this.compileErrors();
    };

    Inputize.prototype.compileErrors = function() {
        this.$errors.empty();

        if (this.errors.length > 0) {
            this.$tools.addClass("has-error");
        }

        for (var i = 0; i < this.errors.length; i++) {
            var error = this.errors[i];
            var $error = $(format(Inputize.template['error'], {error: error}));
            this.$errors.append($error);
        }
    };

    Inputize.prototype.showErrors = function()
    {
        this.$errors.show();
    };

    Inputize.prototype.wrapup = function() {
        this.active = false;
        this.clearErrors();
        this.$tools.hide();
        this.$input.val(this.value);
        this.$element
            .html(this.getValueTag(this.value))
            .show()
        ;
        this.generateIcon();
        this.registerState(false);
    };

    Inputize.prototype.registerState = function(state) {
        $('body').data('inputize.active', state);
    };

    Inputize.prototype.getValueTag = function(value) {
        if (this.options.tag.hasOwnProperty(value)) {
            return this.options.tag[value];
        }

        var payload;
        if (this.options.factory.hasOwnProperty('options')) {
            var options = this.options.factory.options;
            options.every(function (option) {
                if (option.value == value) {
                    payload = option.label;
                    return false;
                }
                return true;
            });
            if (! payload) {
                payload = this.$input.find(':selected').text();     // For options loaded via callback
            }
        } else if (this.$input && this.$input.find('option').length !== 0) {
            payload = this.$input.find(':selected').text();         // For lookup inputs
        } else if (value === '' && this.hasPlaceholder()) {
            payload = this.getPlaceholderMarkup();
        } else {
            payload = value.toString().trim().nl2br();
        }

        return payload;
    };

    Inputize.prototype.destroy = function() {
        var ev = Inputize.namespaceEvent;
        this.$element.unbind(ev('click'));
        this.$element.unbind(ev('success'));
        this.$element.unbind(ev('error'));
        if (this.$confirmButton > 0) {
            this.$confirmButton.unbind(ev('click'));
        }
        if (this.$cancelButton > 0) {
            this.$cancelButton.unbind(ev('click'));
        }
        this.$element
            .html(this.getValueTag(this.value))
            .show()
        ;
        this.$element.removeClass('editable');
        this.$element.data(pluginName, null);
    };

    $.fn[pluginName] = function (options, args) {

        var result;

        this.each(function () {
            var _this = $.data(this, pluginName);
            if (typeof options === 'string') {
                if (!_this) {
                    console.log('Not initialized, can not call method : ' + options);
                    return true; // continue
                }
                if (! $.isFunction(_this[options]) || options.charAt(0) === '_') {
                    console.log('No such method : ' + options);
                    return true; // continue
                }
                if (!(args instanceof Array)) {
                    args = [ args ];
                }
                result = _this[options].apply(_this, args);
                return true; // continue
            }
            if (typeof options === 'boolean') {
                result = _this;
                return true; // continue
            }
            $.data(this, pluginName, new Inputize(this, options));
        });

        return result || this;
    };

}(jQuery, window));
