/*The logic for visualising the widget is as below */

/* Code References */
/* WDeStuP- (https://github.com/kecso/WDeStuP)
* StateMachineJoint (https://github.com/kecso/StateMachineJoint)
* PeNDeS (https://github.com/umesh-timalsina/PeNDeS)
* WebGME-petrinet-visualizer(https://github.com/dragazo/WebGME-petrinet-visualizer) */

/*For Markings inside the circle */
let div = 4;

/*If Divisible by 4 then we are saving the character and going to the next line */
function aDiv(number){
    const arr = [];
    var spl = "";
    for(let i=0;i<number;i++)
    {
        if(i % div == 0 && i >= div)
        {
            spl+=("\n");
        } else{
            spl+=("⬤");
        }
    }
    if(spl==""){
        arr.push(spl);
    }
    arr.push(spl);
    //returning spl array of all 12 black disks
    return spl;
}

const markings = aDiv(12);
console.log(markings);

/*To send marks attributes to places */
function getMarks(place) {
    return place.attr('marks');
}

/*Placing the markings string in the places attributes */
function updateMarks(place, count) {
    place.attr('marks', count);
    place.attr('label/text', aDiv(count));
}

/* Using the JOINTJS package for representing all the graphical syntax of the petri net */
define(['jointjs', 'css!./styles/visualizerWidget.css', 'css!jointjscss'], function (jointjs) {
    'use strict';

    /*To represent the container */
    function visualizerWidget(logger, container, client) {
        this._logger = logger.fork('Widget');

        this._el = container;
        this._client = client;

        /*As the Petrinet comprises of Places, Transitions and Arcs ; Setting empty initially */
        this._places = {};
        this._transitions = {};
        this._arcs = {};
        this._missingArcs = {};

        this._initialize();

        this._logger.debug('Container Finished');
    }

    /*To initialise the containers */
    visualizerWidget.prototype._initialize = function () {
        const width = this._el.width();
        const height = this._el.height();
        const self = this;

        this._el.addClass('visualizer');

        //initialising the paper and graph using the height and width obtained */
        /* The graph contains a reference to all components of the container, 
        and the paper is responsible for rendering the graph.*/
        this._graph = new jointjs.dia.Graph;
        this._paper = new jointjs.dia.Paper({
            el: $(this._el),
            width: width, 
            height: height,
            gridSize: 1,
            model: this._graph,
        });

        /*When a pointer is clicked it basically fires the black disks from the transitions */
        this._paper.on('element:pointerclick', function(view) {
            const elem = view.model;
            /*to implement that we need to retrieve the transition ID */
            const trans = self.getTransitionID(elem.id);
            //using strict inequality operator to compare different operands
            if (trans !== undefined) {
                if (self.isTransitionEnabled(trans)) self.fireEvent(trans);
            }
        });

         /*When a mousewheel is clicked it basically fires the black disks to the places */
        this._paper.on('element:mousewheel', function(view, evt, x, y, delta) {
            const elem = view.model;
            /*to implement that we need to retrieve the place ID */
            const place = self.getPlaceID(elem.id);
            //using strict inequality operator to compare different operands
            if (place !== undefined) {
                if (delta != 0) { 
                    const marks = getMarks(place.simnode);
                    updateMarks(place.simnode, delta > 0 ? marks + 1 : marks - 1);
                    self.updateColors(); 
                }
            }
        });

        /*CSS definitions for each of the fields for Place using JointJS */
        this._place = jointjs.dia.Element.define('network.Place', {
            attrs: {
                //for the circle of Places
                circle: {
                    r: 30,
                    'stroke-width': 3,
                    stroke: 'green',
                    fill: '#ffa500',
                    cursor: 'pointer',
                    
                },
                //for the text above the Places
                text: {
                    'ref-x': 0.5,
                    'ref-y': -20,
                    'ref': 'circle',
                    'font-weight': '800',
                    'text-anchor': 'middle',
                    cursor: 'pointer',
                    fontWeight: 'bold',
                    fontVariant: 'small-caps'
                },
                //for the markings inside the circle
                label: {
                    'ref-y': 20,
                    'ref': 'circle',
                     cursor: 'pointer',
                    'font-weight': '400',
                    'text-anchor': 'middle',
                    fill: '#800080', 
                },
                marks: 0,
            },
        }, {
            markup: [
                { tagName: 'circle', selector: 'circle' },
                { tagName: 'text', selector: 'text' },
                { tagName: 'text', selector: 'label' },
            ],
        });
    };

   
   //To resize the widget as per the height & width */ 
   visualizerWidget.prototype.onWidgetContainerResize = function (width, height) {
        this._logger.debug('Resize Widget');
        if (this._paper) {
            this._paper.setDimensions(width, height);
            this._paper.scaleContentToFit();
        }
    };

    /* For switching back to its initial markings */
    visualizerWidget.prototype.resetMarkings = function() {
        const places = Object.values(this._places);
        for (const place of places) {
            updateMarks(place.simnode, place.gmenode.getAttribute('initMarking'));
        }
        /*Updates color back to blue after reset */
        this.updateColors();
    };

   /*To retrieve Inplaces for the classification logic */ 
   /* Inplace is where the place is src and transition is dest */
   visualizerWidget.prototype.getTotalInplaces = function(trans) {
        const Inplacevalue = [];
        const arcs = Object.values(this._arcs);
        for (const arc of arcs) {
            if (arc.dst == trans) 
            {
                Inplacevalue.push({ place: arc.src, arc });
            }
        }
        return Inplacevalue;
    };

    /*To retrieve Outplaces for the classification logic */ 
    /* Outplace is where the place is dest and transition is src */
    visualizerWidget.prototype.getTotalOutplaces = function(trans) {
        const OutPlacevalue = [];
        const arcs = Object.values(this._arcs);
        for (const arc of arcs) {
            if (arc.src == trans) 
            {
                OutPlacevalue.push({ place: arc.dst, arc });
            }
        }
        return OutPlacevalue;
    };

    /*Updating colors for enabling transition */
    /* Blue - Enable */
    /* Black - Disabled */
    /* Red - Deadlock */
   visualizerWidget.prototype.updateColors = function() {
        let anyEnabled = false;
        const blue = '#00aacc';
        const black = '#000000';
        const red = '#ff0000';
        const transitions = Object.values(this._transitions);
        for (const trans of transitions) {
            const enabled = this.isTransitionEnabled(trans)
            if (enabled) anyEnabled = true;
            //By default color is blue ; after fire transitions and disabled , the color changes to black
            const color = enabled ? blue : black;
            trans.simnode.attr('.root/fill', color); 
        }
        if (!anyEnabled) {
            //once reached deadlock; color changes to Red and no more transitions
            for (const trans of transitions) {
                trans.simnode.attr('.root/fill', red); 
            }
        }
    }

    //to verify whether the transition is enabled and using that for Update colors
    visualizerWidget.prototype.isTransitionEnabled = function(trans) {
        const inplaces = this.getTotalInplaces(trans);
        for (const i of inplaces) {
            if (getMarks(i.place.simnode) <= 0) return false;
        }
        return true;
    };

    //to fire transition from places to transition and vice-versa
    visualizerWidget.prototype.fireEvent = function(trans) {
        const inplaces = this.getTotalInplaces(trans);
        const outplaces = this.getTotalOutplaces(trans);
        const self = this;
        const color = '#3ae014';
        //this logic is to handle out places and update the colors accordingly 
        const manageOutplaces = function() {
            for (const o of outplaces) {
                o.arc.simnode.findView(self._paper).sendToken(jointjs.V('circle', { r: 5, fill: color }), 500, () => {
                    updateMarks(o.place.simnode, getMarks(o.place.simnode) + 1);
                    self.updateColors(); 
                });
            }
        };
        //this logic is to handle in places and update the colors accordingly
        if (inplaces.length !== 0) {
            for (const i of inplaces) {
                updateMarks(i.place.simnode, getMarks(i.place.simnode) - 1);
            }
            this.updateColors();
            const last = inplaces.pop();
            for (const i of inplaces) {
                i.arc.simnode.findView(this._paper).sendToken(jointjs.V('circle', { r: 5, fill: color }), 500);
            }
            last.arc.simnode.findView(this._paper).sendToken(jointjs.V('circle', { r: 5, fill: color }), 500, manageOutplaces);
        }
        else manageOutplaces(); 
    };

    //PlaceID gets the id for the simnode that we need to incorporate in our logic
    visualizerWidget.prototype.getPlaceID = function(id) {
        const places = Object.values(this._places);
        for (const place of places) {
            if (place.simnode.id === id) 
            {
                return place;
            }
        }
        return undefined;
    };


    //TransitionID gets the id for the simnode that we need to incorporate in our logic
    visualizerWidget.prototype.getTransitionID = function(id) {
        const transitions = Object.values(this._transitions);
        for (const trans of transitions) {
            if (trans.simnode.id === id) 
            {
                return trans;
            }
        }
        return undefined;
    };

   //this logic is to check if the given id is a Place or a Transition and returning in else giving undefined
    visualizerWidget.prototype.getPlaceOrTrans = function(id) {
        if (id in this._places)
        { 
            return this._places[id];
        }
        if (id in this._transitions)
         {
            return this._transitions[id];
         }
        return undefined;
    };

    /* we are implementing the below logic in order add arcs between places and transitions */
    visualizerWidget.prototype.addArcs = function () {
        const done = [];
        const missingArcs = Object.keys(this._missingArcs);
        for (const key of missingArcs) {
            const value = this._missingArcs[key];
            const src = this.getPlaceOrTrans(value.src);
            const dst = this.getPlaceOrTrans(value.dst);
            if (src !== undefined && dst !== undefined) {
                done.push(key);
                let exception = false;
                const otherarcs = Object.values(this._arcs);
                for (const other of otherarcs) {
                    if (other.src === src && other.dst === dst) {
                        exception = true;
                        break;
                    }
                }
                if (exception) continue; 

                const arc = new jointjs.shapes.standard.Link();
                arc.source(src.simnode, { anchor: { name: 'center' } });
                arc.target(dst.simnode, { anchor: { name: 'center' } });
                this._graph.addCell([arc]);
                this._arcs[key] = {
                    id: key,
                    src, dst,
                    simnode: arc,
                    gmenode: value.gmenode,
                };
            }
        }
        for (const key of done) {
            delete this._missingArcs[key];
        }
    };
    
    /*The below block of code is where we add the node to the widget and iterate with it */
    visualizerWidget.prototype.addNode = function (desc) {
        const self = this;

        //updating all new fields by first getting the node
        const node = this._client.getNode(desc.id);
        //starting of with validating if the node is a Place
        if (node.isInstanceOf('Places')) {
            const position = node.getRegistry('position');
            const place = new this._place({
                position,
                attrs: {
                    text: { text: node.getAttribute('name') },
                },
            });
            //updating the markings and declaring the fields
            updateMarks(place, node.getAttribute('initMarking'));
            this._graph.addCell([place]);
            this._places[desc.id] = {
                id: desc.id,
                simnode: place,
                gmenode: node,
            };
            
            //after adding the nodes, we are adding the arcs and updating the colors as well
            this.addArcs();
            this.updateColors();
        }
        //validating if the node is Transiton
        else if (node.isInstanceOf('Transition')) {
            const position = node.getRegistry('position');
            const trans = new jointjs.shapes.pn.Transition({
                position: { x: position.x - 5, y: position.y - 23 },
                attrs: {
                    '.label': { text: node.getAttribute('name'), fill: '#000000' },
                    '.root': { fill: '#000000', stroke: '#000000' },
                },
            });
             //updating the markings and declaring the fields
            this._graph.addCell([trans]);
            this._transitions[desc.id] = {
                id: desc.id,
                simnode: trans,
                gmenode: node,
            };
            //after adding the nodes, we are adding the arcs and updating the colors as well
            this.addArcs();
            this.updateColors();
        }
        //validating if the node is an arc and setting its source and destinaton
        else if (node.isInstanceOf('Arc')) {
            const src = node.getPointerId('src');
            const dst = node.getPointerId('dst');
            this._missingArcs[desc.id] = {
                src, dst,
                gmenode: node,
            };
            this.addArcs();
            this.updateColors();
        }
    };
    
    //calling removenode to remove it form the list
    visualizerWidget.prototype.removeNode = function (gmeId) {
    };

    //calling update in order to update the nodes in the list 
    visualizerWidget.prototype.updateNode = function (desc) {
    };

    //calling the visualizer lifecycle callback function to destroy
    visualizerWidget.prototype.destroy = function () {
    };

    //calling the visualizer lifecycle callback function to activate
    visualizerWidget.prototype.onActivate = function () {
        this._logger.debug('visualizerWidget has been activated');
    };

    //calling the visualizer lifecycle callback function to activate
    visualizerWidget.prototype.onDeactivate = function () {
        this._logger.debug('visualizerWidget has been deactivated');
    };

    return visualizerWidget;
});