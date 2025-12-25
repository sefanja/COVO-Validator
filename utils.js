/**
 * COVO Utility Module for jArchi
 * Contains reusable functions for hierarchy analysis, graph traversal, and visual feedback.
 */
var utils = (function() {
    
    /**
     * Ensures an object or collection is always a jArchi collection.
     * @param {object|collection} objectOrCollection 
     * @returns {collection} jArchi collection
     */
    function wrap(objectOrCollection) {
        return objectOrCollection && typeof objectOrCollection.size === 'function' ? objectOrCollection : $(objectOrCollection);
    }

    /**
     * Tests whether some thing is an ArchiMate relationship.
     * @param {*} thing 
     * @returns {boolean}
     */
    function isRelationship(thing) {
        if (!thing) return false;
        return thing.type.endsWith('-relationship');
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
     * Returns an array of all unique levels present in a collection of elements and/or relationships.
     * @param {collection} concepts 
     * @returns {number[]}
     */
    function getLevels(concepts) {
        return Array.from(new Set(wrap(concepts).flatMap(c =>
            isRelationship(c) ? [getLevel(c.source), getLevel(c.target)] : [getLevel(c)]
        )));
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
     * Gets all elements connected to the given elements via relationships within the given scope,
     * optionally filtered by element type.
     * @param {collection|object} elements - The starting elements.
     * @param {string} [endType] - Optional ArchiMate type to filter the results.
     * @returns {collection}
     */
    function getRelated(elements, scope, endType = '*') {
        const elementIds = new Set(wrap(elements).map(e => e.id));
        return scope.filter(r => elementIds.has(r.source.id) || elementIds.has(r.target.id)).ends(endType);
    }

    /**
     * Gets elements that are the sources of relationships within the given scope,
     * pointing to the given targets, optionally filtered by source type.
     * @param {collection|object} targets - The target elements.
     * @param {collection} scope - Relationships within scope.
     * @param {string} [sourceType] - Optional ArchiMate type to filter the sources.
     * @returns {collection}
     */
    function getSources(targets, scope, sourceType = '*') {
        const targetIds = new Set(wrap(targets).map(e => e.id));
        return scope.filter(r => targetIds.has(r.target.id)).sourceEnds(sourceType);
    }

    /**
     * Gets elements that are the targets of relationships within the given scope,
     * originating from the given sources, optionally filtered by a target type.
     * @param {collection|object} sources - The source elements.
     * @param {collection} scope - Relationships within scope.
     * @param {string} [targetType] - Optional ArchiMate type to filter the targets.
     * @returns {collection}
     */
    function getTargets(sources, scope, targetType = '*') {
        const sourceIds = new Set(wrap(sources).map(e => e.id));
        return scope.filter(r => sourceIds.has(r.source.id)).targetEnds(targetType);
    }

    /**
     * Checks if a direct relationship within the given scope exists between two sets of elements.
     * @param {collection} collection1 
     * @param {collection} collection2 
     * @param {collection} scope - Relationships within scope.
     * @returns {boolean}
     */
    function isRelated(collection1, collection2, scope) {
        return isOverlapping(getRelated(collection1, scope), collection2);
    }

    /**
     * Uses Breadth-First Search (BFS) to find if a path exists from a source element,
     * optionally through same-type elements, to an element of the given target type,
     * via relations within the given scope.
     * 
     * Example: A capability supporting another capability that manifests as a value stream.
     * @param {object} sourceElement 
     * @param {collection} scope - Relationships within scope.
     * @param {string} targetType 
     * @returns {boolean}
     */
    function isRelatedTransitively(sourceElement, scope, targetType) {
        const queue = [sourceElement];
        const visited = new Set([sourceElement.id]);

        while (queue.length > 0) {
            const currentElement = queue.shift();

            const targetElements = getTargets(currentElement, scope, targetType);
            if (targetElements.size() > 0) return true;

            const relatedSameTypeElements = getTargets(currentElement, scope, currentElement.type);
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
     * Filters a collection by allowed levels.
     */
    function filterByLevel(collection, levels) {
        return collection.filter(e => levels.includes(getLevel(e)));
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
    function isConnected(nodes, scope) {
        if (nodes.size() <= 1) return true;

        const nodeIds = new Set(nodes.map(n => n.id));
        const visited = new Set();
        const queue = [nodes.first()];
        visited.add(nodes.first().id);
        
        while (queue.length > 0) {
            const current = queue.shift();
            getRelated(current, scope).each(neighbor => {
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
        isRelationship: isRelationship,
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
        getRelated: getRelated,
        getSources: getSources,
        getTargets: getTargets,
        isRelated: isRelated,
        isRelatedTransitively: isRelatedTransitively,
        filterByLevel: filterByLevel,
        filterByLevelAdjacency: filterByLevelAdjacency,
        crossesBoundary: crossesBoundary,
        isOwnAncestor: isOwnAncestor,
        isConnected: isConnected,
        flash: flash
    };

})();
