/**
 * COVO Utility Module for jArchi
 * Contains reusable functions for hierarchy analysis, graph traversal, and visual feedback.
 */
var utils = (function() {
    
    // --- INTERNAL HELPERS ---

    /**
     * Ensures an object or collection is always a jArchi collection.
     * @param {object|collection} objectOrCollection 
     * @returns {collection} jArchi collection
     */
    function wrap(objectOrCollection) {
        return objectOrCollection && typeof objectOrCollection.size === 'function' ? objectOrCollection : $(objectOrCollection);
    }

    // --- SET OPERATIONS ---

    /**
     * Returns the intersection of two or more collections.
     * @param {collection} first - The base collection.
     * @param {...collection} rest - Other collections to compare.
     * @returns {collection}
     */
    function getIntersection(first, ...rest) {
        let result = wrap(first);
        for (const next of rest) {
            const IDs = wrap(next).map(e => e.id);
            result = result.filter(e => IDs.includes(e.id));
        }
        return result;
    }

    /**
     * Checks if two or more collections overlap.
     * @param {...collection} concepts 
     * @returns {boolean}
     */
    function isOverlapping(...concepts) {
        return getIntersection(...concepts).size() > 0;
    }

    // --- HIERARCHY & STRUCTURE (Vertical) ---

    /**
     * Returns the immediate parent via the defined refinement relationship.
     * @param {object} element 
     * @returns {object|undefined}
     */
    function getParent(element) {
        return wrap(element).inRels(config.TYPES.refinement).sourceEnds().first();
    }

    /**
     * Checks if an element has more than one parent via refinement.
     * @param {object} element 
     * @returns {boolean}
     */
    function hasMultipleParents(element) {
        return wrap(element).inRels(config.TYPES.refinement).sourceEnds().size() > 1;
    }

    /**
     * Returns all immediate children via refinement relationships.
     * @param {object} element 
     * @returns {collection}
     */
    function getChildren(element) {
        return wrap(element).outRels(config.TYPES.refinement).targetEnds();
    }

    /**
     * Checks if an element is a leaf (no children via refinement).
     * @param {object} element 
     * @returns {boolean}
     */
    function isLeaf(element) {
        return getChildren(element).size() === 0;
    }

    /**
     * Finds the top-level element (root) in the hierarchy.
     * @param {object} element 
     * @returns {object} The root element.
     */
    function getRoot(element) {
        let current = element;
        const visited = new Set();
        while (!visited.has(current.id)) {
            visited.add(current.id);
            const parent = getParent(current);
            if (!parent) return current;
            current = parent;
        }
    }

    /**
     * Returns unique roots for a collection of elements.
     * @param {collection} elements 
     * @returns {collection}
     */
    function getRoots(elements) {
        const roots = $();
        wrap(elements).each(e => roots.add(getRoot(e)));
        return roots;
    }

    // --- DEPTH & LEVELS ---

    const levelCache = {};
    /**
     * Determines the hierarchical depth (0 = root). Results are cached.
     * @param {object} element 
     * @returns {number}
     */
    function getLevel(element) {
        if (levelCache[element.id] !== undefined) return levelCache[element.id];

        var depth = 0;
        var current = element;
        var visited = new Set();
        
        while (!visited.has(current.id)) {
            visited.add(current.id);
            var parent = getParent(current);
            if (!parent) break;
            current = parent;
            depth++;
        }

        levelCache[element.id] = depth;
        return depth;
    }

    /**
     * Returns an array of all unique levels present in a collection.
     * @param {collection} elements 
     * @returns {number[]}
     */
    function getLevels(elements) {
        return Array.from(new Set(wrap(elements).map(getLevel)));
    }

    /**
     * Determines the most frequent level in a collection.
     * @param {collection} elements 
     * @returns {number|null}
     */
    function getDominantDepth(elements) {
        const depthCounts = {};
        elements.each(e => {
            const d = getLevel(e);
            depthCounts[d] = (depthCounts[d] || 0) + 1;
        });

        let dominantDepth = null;
        let maxFound = 0;
        for (let d in depthCounts) {
            if (depthCounts[d] > maxFound) {
                maxFound = depthCounts[d];
                dominantDepth = Number(d);
            }
        }
        return dominantDepth;
    }

    // --- RELATIONSHIPS & FILTERING (Horizontal) ---

    /**
     * Checks if a direct relationship exists between two sets of elements.
     * @param {collection} collection1 
     * @param {collection} collection2 
     * @returns {boolean}
     */
    function isRelated(collection1, collection2) {
        return isOverlapping(wrap(collection1).rels().ends(), collection2);
    }

    /**
     * Uses Breadth-First Search (BFS) to find if a path exists from 
     * a source element, optionally through same-type elements, to an
     * element of the given target type, via horizontal relations.
     * 
     * Example: A capability supporting another capability that manifests
     * as a value stream.
     * @param {object} sourceElement 
     * @param {string} targetType 
     * @returns {boolean}
     */
    function isRelatedTransitively(sourceElement, targetType) {
        const queue = [sourceElement];
        const visited = new Set([sourceElement.id]);

        while (queue.length > 0) {
            const currentElement = queue.shift();

            const targetElements = $(currentElement).outRels().targetEnds(targetType);
            if (targetElements.size() > 0) return true;

            const relatedSameTypeElements = $(currentElement).outRels().targetEnds(currentElement.type);
            relatedSameTypeElements.each(e => {
                if (!visited.has(e.id)) {
                    visited.add(e.id);
                    queue.push(e);
                }
            });
        }
        return false;
    }

    /**
     * Returns levels of collection1 that are connected to collection2.
     */
    function getRelatedLevels(collection1, collection2) {
        return getLevels(getIntersection(collection2.rels().not(config.TYPES.refinement).ends(), collection1));
    }

    /**
     * Filters a collection by allowed levels.
     */
    function filterByLevel(collection, levels) {
        return collection.filter(e => levels.includes(getLevel(e)));
    }

    /**
     * Filters collection1 based on levels having a relationship with collection2.
     */
    function filterByRelatedLevels(collection1, collection2) {
        return filterByLevel(collection1, getRelatedLevels(collection1, collection2));
    }

    /**
     * Filters relationships for partial validation based on level adjacency.
     * @param {collection} relationships 
     * @param {number} offset (-1 for parent layer, 1 for child layer)
     */
    function filterByLevelAdjacency(relationships, offset) {
        const buckets = {};
        relationships.each(r => {
            const key = r.source.type + "->" + r.target.type;
            if (!buckets[key]) buckets[key] = new Set();
            buckets[key].add(getLevel(r.source));
        });

        return relationships.filter(r => {
            const key = r.source.type + "->" + r.target.type;
            const currentLevel = getLevel(r.source);
            return buckets[key].has(currentLevel) && buckets[key].has(currentLevel + offset);
        });
    }

    /**
     * Checks if a relation crosses boundaries between different root elements.
     * @param {object} r - The relationship.
     * @returns {boolean}
     */
    function crossesBoundary(r) {
        return getRoot(r.source).id !== getRoot(r.target).id;
    }

    // --- GRAPH TOPOLOGY ---

    /**
     * Checks for cyclic references in the hierarchy.
     */
    function isOwnAncestor(element) {
        let current = element;
        const initialId = element.id;
        while (true) {
            const parent = getParent(current);
            if (!parent) break;
            if (parent.id === initialId) return true;
            current = parent;
        }
        return false;
    }

    /**
     * Checks if a collection of nodes forms a connected graph.
     */
    function isConnected(nodes) {
        if (nodes.size() <= 1) return true;

        const nodeIds = new Set(nodes.map(n => n.id));
        const visited = new Set();
        const queue = [nodes.first()];
        visited.add(nodes.first().id);
        
        while (queue.length > 0) {
            const current = queue.shift();
            $(current).rels().not(config.TYPES.refinement).ends().each(neighbor => {
                if (!visited.has(neighbor.id) && nodeIds.has(neighbor.id)) {
                    visited.add(neighbor.id);
                    queue.push(neighbor);
                }
            });
        }
        return visited.size === nodes.size();
    }

    // --- UI & FEEDBACK ---

    /**
     * Flashes elements/relationships in views.
     */
    function flash(concepts) {
        if (!config.FLASH.enabled) return;

        const collection = concepts.objectRefs();
        if (!collection || collection.size() === 0) return;

        const originalStates = [];
        collection.each(concept => {
            originalStates.push({
                concept: concept,
                fill: concept.fillColor,
                line: concept.lineColor,
                lineWidth: concept.lineWidth
            });
        });

        const display = org.eclipse.swt.widgets.Display.getDefault();

        for (let i = 0; i < config.FLASH.count; i++) {
            collection.each(function(c) {
                if (c.type.indexOf("relationship") !== -1) {
                    c.lineColor = config.FLASH.color;
                    c.lineWidth = 5;
                } else {
                    c.fillColor = config.FLASH.color;
                    c.lineColor = config.FLASH.color;
                }
            });

            while (display.readAndDispatch());
            java.lang.Thread.sleep(config.FLASH.speed);

            originalStates.forEach(function(state) {
                state.concept.fillColor = state.fill;
                state.concept.lineColor = state.line;
                state.concept.lineWidth = state.lineWidth;
            });

            while (display.readAndDispatch());
            java.lang.Thread.sleep(config.FLASH.speed);
        }
    }

    return {
        getIntersection: getIntersection,
        isOverlapping: isOverlapping,
        getParent: getParent,
        hasMultipleParents: hasMultipleParents,
        getChildren: getChildren,
        isLeaf: isLeaf,
        getRoot: getRoot,
        getRoots: getRoots,
        getLevel: getLevel,
        getLevels: getLevels,
        getDominantDepth: getDominantDepth,
        isRelated: isRelated,
        isRelatedTransitively: isRelatedTransitively,
        getRelatedLevels: getRelatedLevels,
        filterByLevel: filterByLevel,
        filterByLevelAdjacency: filterByLevelAdjacency,
        filterByRelatedLevels: filterByRelatedLevels,
        crossesBoundary: crossesBoundary,
        isOwnAncestor: isOwnAncestor,
        isConnected: isConnected,
        flash: flash
    };

})();
