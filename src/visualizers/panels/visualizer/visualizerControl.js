 /* Code References */
/* WDeStuP- (https://github.com/kecso/WDeStuP)
* StateMachineJoint (https://github.com/kecso/StateMachineJoint)
* PeNDeS (https://github.com/umesh-timalsina/PeNDeS)
* WebGME-petrinet-visualizer(https://github.com/dragazo/WebGME-petrinet-visualizer) */
  
 define([
    'js/Constants',
    'js/Utils/GMEConcepts',
    'js/NodePropertyNames'
], function (
    CONSTANTS,
    GMEConcepts,
    nodePropertyNames
) {

    'use strict';

    function visualizerControl(options) {

        //Initializing primary collections and variables 
        this._logger = options.logger.fork('Control');

        this._client = options.client;

        this._widget = options.widget;
        
        this._currentNodeId = null;
        this._currentNodeParentId = undefined;

        this._initWidgetEventHandlers();
        this._logger.debug('ctor finished');
    }

   visualizerControl.prototype._initWidgetEventHandlers = function () {
        this._widget.onNodeClick = function (id) {
             // Change the current active object
            WebGMEGlobal.State.registerActiveObject(id);
        };
    };
    
    /* * * * * * * * Visualizer content update callbacks * * * * * * * */
    // One major concept here is with managing the territory. The territory
    // defines the parts of the project that the visualizer is interested in
    // (this allows the browser to then only load those relevant parts).
    visualizerControl.prototype.selectedObjectChanged = function (nodeId) {
        var self = this;

         // Remove current territory patterns
        if (self._currentNodeId) {
            self._client.removeUI(self._territoryId);
            self._networkRootLoaded = false;
        }

        self._currentNodeId = nodeId;

        if (typeof self._currentNodeId === 'string') {

            self._selfPatterns = {};
            self._selfPatterns[nodeId] = {children: 1};  // Territory "rule"

            self._territoryId = self._client.addUI(self, function (events) {
                self._eventCallback(events);
            });

            // Update the territory
            self._client.updateTerritory(self._territoryId, self._selfPatterns);
        }
    };

     /* * * * * * * * Node Event Handling * * * * * * * */
    visualizerControl.prototype._eventCallback = function (events) {
        var i = events ? events.length : 0,
        event;

        while(i--) {
            event = events[i];
            if(event.etype=='load'){
                this._loadTerritory(event.eid);
            }
            else if(event.etype=='update'){
                this._updateTerritory(event.eid);
            }
            else if(event.etype=='unload'){
                this._unloadTerritory(event.eid);
            }
        }
    };

    visualizerControl.prototype._getObject = function (nodeId) {
        var node = this._client.getNode(nodeId),
            obj;
        if (node) {
            obj = {
                id: node.getId(),
                name: node.getAttribute(nodePropertyNames.Attributes.name),
                childrenIds: node.getChildrenIds(),
                parentId: node.getParentId(),
                isConnection: GMEConcepts.isConnection(nodeId)
            };
        }
        return obj;
    };
    
    /*Load function calls addnode */
    visualizerControl.prototype._loadTerritory = function (gmeId) {
        var description = this._getObject(gmeId);
        this._widget.addNode(description);
    };

    /*Update function invokes updateNode */
    visualizerControl.prototype._updateTerritory = function (gmeId) {
        var description = this._getObject(gmeId);
        this._widget.updateNode(description);
    };

    /*Remove function invokes removeNode */
    visualizerControl.prototype._unloadTerritory = function (gmeId) {
        this._widget.removeNode(gmeId);
    };

    /*To track if the active object has been changes */
    visualizerControl.prototype._stateActiveObjectChanged = function (model, activeObjectId) {
        if (this._currentNodeId === activeObjectId) {
        } else {
            this.selectedObjectChanged(activeObjectId);
        }
    };

     /* * * * * * * * Visualizer life cycle callbacks * * * * * * * */
    visualizerControl.prototype.destroy = function () {
        this._detachClientEventListeners();
        this._removeToolbarItems();
    };

    visualizerControl.prototype._attachClientEventListeners = function () {
        this._detachClientEventListeners();
        WebGMEGlobal.State.on('change:' + CONSTANTS.STATE_ACTIVE_OBJECT, this._stateActiveObjectChanged, this);
    };

    visualizerControl.prototype._detachClientEventListeners = function () {
        WebGMEGlobal.State.off('change:' + CONSTANTS.STATE_ACTIVE_OBJECT, this._stateActiveObjectChanged);
    };

    visualizerControl.prototype.onActivate = function () {
        this._attachClientEventListeners();
        this._displayToolbarItems();

        if (typeof this._currentNodeId === 'string') {
            WebGMEGlobal.State.registerActiveObject(this._currentNodeId, {suppressVisualizerFromNode: true});
        }
    };

    visualizerControl.prototype.onDeactivate = function () {
        this._detachClientEventListeners();
        this._hideToolbarItems();
    };

    /* * * * * * * * * * Updating the toolbar * * * * * * * * * */
    visualizerControl.prototype._displayToolbarItems = function () {

        if (this._toolbarInitialized === true) {
            for (var i = this._toolbarItems.length; i--;) {
                this._toolbarItems[i].show();
            }
        } else {
            this._initializeToolbar();
        }
    };

    /*To hide toolbar items */
    visualizerControl.prototype._hideToolbarItems = function () {

        if (this._toolbarInitialized === true) {
            for (var i = this._toolbarItems.length; i--;) {
                this._toolbarItems[i].hide();
            }
        }
    };

    /*To destroy the toolbar items */
    visualizerControl.prototype._removeToolbarItems = function () {

        if (this._toolbarInitialized === true) {
            for (var i = this._toolbarItems.length; i--;) {
                this._toolbarItems[i].destroy();
            }
        }
    };

    /*To initialise the toolbar items */
    visualizerControl.prototype._initializeToolbar = function () {
        const self = this;
        const toolBar = WebGMEGlobal.Toolbar;
        this._toolbarItems = [];
        this._toolbarItems.push(toolBar.addSeparator());
        //Adding the Classify Network Button 
        this.$btnClassify = toolBar.addButton({
            title: 'Classify Network',
            icon: 'glyphicon glyphicon-eye-open',
            clickFn: function (/*data*/) {

            const context = self._client.getCurrentPluginContext('state',self._currentNodeId, []);
                                
            context.pluginConfig = {};
            self._client.runServerPlugin(
    
            'state', 
            context, 
            function(err, result){
                            
            console.log('plugin err:', err);
            console.log('plugin result:', result);
            //const txt = result;
            for(var i=0; i<result.messages.length; i++)
            {
              //var text = []
              //text.push(result.messages[i].message)
              //using CONFIRM to display the classification messages on the scree
              //All 4 messages for each type will be displayed one by one after clicking the OK on the popup dialog
              confirm(result.messages[i].message);
            }
                                        
            });
        }
    });
        
        //pushing the Classify button on to the toolbar
        this._toolbarItems.push(this.$btnClassify);
        
        //adding the Reset button
        this.$btnReset = toolBar.addButton({
            title: 'Reset Markings',
            icon: 'glyphicon glyphicon-repeat',
            clickFn: () => { 
                self._widget.resetMarkings()
                alert("This will Reset the network to Initial Marking");
            }
        });

        //Pushing the Reset button to the toolbar 
        this._toolbarItems.push(this.$btnReset);

        this._toolbarInitialized = true; 
    };

    return visualizerControl;
});