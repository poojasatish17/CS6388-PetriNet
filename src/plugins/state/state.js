/*The logic for the plugin is as below */

/* Code References */
/* WDeStuP- (https://github.com/kecso/WDeStuP)
* StateMachineJoint (https://github.com/kecso/StateMachineJoint)
* PeNDeS (https://github.com/umesh-timalsina/PeNDeS)
* WebGME-petrinet-visualizer(https://github.com/dragazo/WebGME-petrinet-visualizer) */

define([
    'q',
    'plugin/PluginConfig',
    'text!./metadata.json',
    'plugin/PluginBase',
    'module'
], function (
    Q,
    PluginConfig,
    pluginMetadata,
    PluginBase,
    module
) {
    'use strict';

    pluginMetadata = JSON.parse(pluginMetadata);

    //setting up the function to print the messages to classify the type of Petrinet
    const getPetriNetMessages = function (classifications) {
        let txt = [];
        if (classifications.isFreeChoicePetriNet) {
            txt.push("This Example is a Free Choice Petrinet");
        } 
        else {
            txt.push("Not a FreeChoice Petrinet. Doesn't have UNIQUE set of Inplaces");
        }

        if (classifications.isStateMachine) {
            txt.push("This Example is a State Machine");
        } 
        else {
            txt.push("Not a State Machine. Doesn't have exactly one INPLACE and OUTPLACE");
        }

        if (classifications.isMarkedGraph) {
            txt.push("This Example is a Marked Graph");
        } 
        else {
            txt.push("Not a Marked Graph. Doesn't have exactly one OUT Transition and one IN Transition");
        }

        if (classifications.isWorkFlowNet) {
            txt.push("This Example is a Work Flow Net");
        } 
        else {
            txt.push("Not a Work Flow Net. Doesn't satisfy the condition");
        }

        return txt;
    };

    //defining class
    class state extends PluginBase {
        constructor() {
            super();
            this.pluginMetadata = pluginMetadata;
        }
        
        //in the main program we are loading the messages we declared above 
        //implementing a try-catch block to handle exceptions
        async main(callback) {
            const activeNode = this.activeNode;

            try {

                if((await this.core.loadChildren(activeNode)).length === 0){
                    throw new Error('No child nodes');
                }
                const classifications = await this.state(activeNode);
                const messages = getPetriNetMessages(classifications);
                messages.forEach(txt => {
                    this.createMessage(
                        activeNode,
                        txt,
                        'info'
                    );
                });

                this.result.setSuccess(true);
            } catch (e) {
                this.logger.error(e.message);
                this.result.setSuccess(false);
                this.createMessage(
                    activeNode,
                    e.message,
                    'error'
                );
            }
            callback(null, this.result);
        }

        //this part is to retrieve the petriNet and sending the parameters and checking
        // which classification logic it is satisfies
        async state(petriNet) {
            let {places, transitions, paths} = await this._getPetriNet(petriNet);
            let isStateMachine = this._isStateMachine(transitions);
            let isMarkedGraph = this._isMarkedGraph(places);
            let isFreeChoicePetriNet = this._isFreeChoicePetriNet(transitions);
            let isWorkFlowNet = this._isWorkFlowNet(places, transitions, paths);
            return {
                isStateMachine,
                isMarkedGraph,
                isFreeChoicePetriNet,
                isWorkFlowNet
            };
        }

        //getting the petrinet // loading the children
        // retrieving the places, transitions and arcs
        async _getPetriNet(petriNet) {
            let children = await this.core.loadChildren(petriNet);
            let places = {};
            let transitions = {};
            let paths = {};
            children.forEach(child => {
                const name = this.core.getAttribute(child, 'name');
                const path = this.core.getPath(child);
                //setting the path for Places ; places exists between transitions ; 
                //hence we are declaring intransitions and outtransitions in the path
                if (this.core.getMetaType(child) === this.META.Places) {
                    places[path] = {
                        name: name,
                        inTransitions: new Set(),
                        outTransitions: new Set()
                    };
                    paths[path] = [];
                }
                 //setting the path for Transitions ; transitions exists between places ; 
                 // hence we are declaring inplaces and outplaces in the path
                 else if (this.core.getMetaType(child) === this.META.Transition) {
                    transitions[path] = {
                        name: name,
                        inPlaces: new Set(),
                        outPlaces: new Set()
                    };
                    paths[path] = [];
                }
            });

            //This part of the logic checks if the arc is present place and transition and vice-versa
            children.forEach(child => {
                //this if-block identifies the Arc from Place to Transition
                /*we check for inplace and set the place as the src
                 because as per definiton the inplace is where the source is the place*/
                /*and we check for out transition as its destination 
                because as per definiton the outtransition is where the destination is the transition*/
                if (this.core.getMetaType(child) === this.META.Arc_Place_Trans) {
                    const inPlacePath = this.core.getPointerPath(child, 'src');
                    const dstTransitionPath = this.core.getPointerPath(child, 'dst');
                    places[inPlacePath].outTransitions.add(dstTransitionPath);
                    transitions[dstTransitionPath].inPlaces.add(inPlacePath);
                    paths[inPlacePath].push(dstTransitionPath);
                } 
                //this else-if-block identifies the Arc from Transition to Place
                /*we check for Outplace and set the place as the destination 
                because as per definiton the outplace is where the destination is the place */
                /*and we check for In transition as its source 
                because as per definiton the intransition is where the source is the transition */
                else if (this.core.getMetaType(child) === this.META.Arc_Trans_Place) {
                    const outPlacePath = this.core.getPointerPath(child, 'dst');
                    const srcTransitionPath = this.core.getPointerPath(child, 'src');
                    places[outPlacePath].inTransitions.add(srcTransitionPath);
                    transitions[srcTransitionPath].outPlaces.add(outPlacePath);
                    paths[srcTransitionPath].push(outPlacePath);
                }
            });

            return {places, transitions, paths};
        }

        //this method checks if the petrinet is a FreeChoice Petrinet
        _isFreeChoicePetriNet(transitions) {
            const allPlaces = new Set();
            let size = 0;
            Object.values(transitions).forEach(transition => {
                transition.inPlaces.forEach(inPlace => allPlaces.add(inPlace));
                size += transition.inPlaces.size;
            });
            //checking if all the transitions if not empty then it should be the same
            if(size === allPlaces.size){
                  return true;
            } else {
                return false;
            }
           
        }

        //This method validates if the petrinet is a State Machine
        _isStateMachine(transitions) {
           // console.log(transitions);
            return Object.values(transitions)
                .every(transition => {
                    
                    //verifies if it has exactly one inplace and one outplace
                    if(transition.inPlaces.size === 1 &&
                        transition.outPlaces.size === 1){
                            return true;
                        } else {
                    return false;
                   }
                });
        }

        //this method validates if the petrinet is a Marked Graph
        _isMarkedGraph(places) {
            return Object.values(places).every(place => {
                //verifies if the intransitions and outtransitions are exactly 1
                if(place.inTransitions.size === 1 &&
                    place.outTransitions.size === 1){
                        return true;
                    } else {
                return false;
               }
            });
        }

        //this method identifies if the Petrinet is a workflow net
        _isWorkFlowNet(places, transitions, paths) {
            const allNodes = Object.keys(places).concat(Object.keys(transitions));
            const source = Object.keys(places).filter(placeId => {
                return places[placeId].inTransitions.size === 0;
            });
            const destination = Object.keys(places).filter(placeId => {
                return places[placeId].outTransitions.size === 0;
            });

            let isWorkFlowNet = false;

            //checking if the source path is 1 and basing the logic on that
            if (source.length === 1 && destination.length === 1) {
                const src = source.pop();
                const dst = destination.pop();
                let allPaths = this._getPaths(src, dst, paths)
                    .reduce((flattened, element) => flattened.concat(element), []);
                isWorkFlowNet = allNodes.every(node => allPaths.includes(node));
            }
            return isWorkFlowNet;
        }

        //retrieve paths based on logic of getpetrinets above 
        _getPaths(src, dst, paths) {
            return state._getAllPaths(paths, src, dst, []);
        }

        //using getPath to retrieve the paths for all 
        static _getAllPaths(graph, start, end, path = []) {
            path = path.concat([start]);
            if (start === end) {
                return [path];
            }
            if (!graph[start]) {
                return [];
            }
            const paths = [];
            graph[start].forEach(node => {
                if (!path.includes(node)) {
                    const newPaths = state._getAllPaths(graph, node, end, path);
                    newPaths.forEach(newPath => {
                        paths.push(newPath);
                    });
                }
            });
            return paths;
        }

    }

    return state;

});