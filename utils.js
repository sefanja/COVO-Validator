/**
 * COVO Utility Module for jArchi
 * Contains reusable functions for hierarchy analysis, graph traversal, and visual feedback.
 */
var utils = (function() {
    const _EMPTY = $(); // cloning this collection is significanlty faster than creating a new one with $()
    
    // --- CORE UTILITIES ---

    /**
     * Ensures input is handled as a jArchi collection for consistent API usage.
     * @param {ArchiMateConcept|jArchiCollection|undefined} input
     * @returns {jArchiCollection}
     */
    function wrap(conceptOrCollection) {
        return conceptOrCollection && typeof conceptOrCollection.size === 'function' ? conceptOrCollection : $(conceptOrCollection);
    }

    /**
     * Determines if a concept is a relationship.
     * @param {ArchiMateConcept} concept
     * @returns {boolean}
     */
    function isRelationship(concept) {
         return !!(concept && concept.source);
    }

    /**
     * Takes a collection of (visual) objects as input and returns a collection of unique concepts.
     * @param {jArchiCollection} objects
     * @returns {jArchiCollection} unique concepts
     */
    function getUniqueConcepts(objects) {
        const added = new Set();
        const concepts = _EMPTY.clone();
        objects.each(o => {
            const c = o.concept;
            if (!added.has(c.id)) {
                concepts.add(c);
                added.add(c.id);
            }
        });
        return concepts;
    }

    // --- SET OPERATIONS ---

    /**
     * Returns the intersection of two or more collections.
     * @param {jArchiCollection} first - The base collection.
     * @param {...jArchiCollection} rest - Other collections to compare.
     * @returns {jArchiCollection}
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
     * @param {...jArchiCollection} concepts
     * @returns {boolean}
     */
    function isOverlapping(...concepts) {
        return getIntersection(...concepts).size() > 0;
    }

    // --- HIERARCHY ---

    /**
     * Traverses the 'refinement' hierarchy upwards to find the immediate parent.
     * Logic is based on the relationship type defined in config.js (default: composition).
     * @param {ArchiMateElement} element
     * @returns {ArchiMateElement|undefined}
     */
    function getParent(element) {
        return wrap(element).inRels(config.TYPES.refinement).sourceEnds().first();
    }

    /**
     * Checks if an element has more than one parent via refinement.
     * @param {ArchiMateElement} element
     * @returns {boolean}
     */
    function hasMultipleParents(element) {
        return wrap(element).inRels(config.TYPES.refinement).sourceEnds().size() > 1;
    }

    /**
     * Returns all immediate children via refinement relationships.
     * @param {ArchiMateElement} element
     * @returns {collection}
     */
    function getChildren(element) {
        return wrap(element).outRels(config.TYPES.refinement).targetEnds();
    }

    /**
     * Checks if an element is a leaf (no children via refinement).
     * @param {ArchiMateElement} element
     * @returns {boolean}
     */
    function isLeaf(element) {
        return getChildren(element).size() === 0;
    }

    /**
     * Performs a recursive search to identify the root element of a refinement hierarchy.
     * Includes cycle detection to prevent infinite loops in malformed models.
     * @param {ArchiMateElement} element
     * @returns {ArchiMateElement} The top-level ancestor.
     */
    function getRoot(element) {
        let current = element;
        const visited = new Set();
        
        while (current) {
            if (visited.has(current.id)) return current; // Cycle detected: return current to avoid loop
            visited.add(current.id);
            const parent = getParent(current);
            if (!parent) return current;
            current = parent;
        }
    }

    /**
     * Returns unique roots for a collection of elements.
     * @param {jArchiCollection} elements
     * @returns {jArchiCollection}
     */
    function getRoots(elements) {
        const roots = _EMPTY.clone();
        const visited = new Set();
        wrap(elements).each(e => {
            const r = getRoot(e);
            if (!visited.has(r.id)) {
                roots.add(r);
                visited.add(r.id);
            }
        });
        return roots;
    }

    /**
     * Calculates hierarchical depth (0 = root). 
     * For relationships, depth is derived from the source element.
     * @param {ArchiMateConcept} concept
     * @returns {number} 0 for roots, >0 for refined elements.
     */
    function getLevel(concept) {
        const element = isRelationship(concept) ? concept.source : concept; // a relationships's level is determined by its source

        let depth = 0;
        let current = element;
        const visited = new Set();
        
        while (!visited.has(current.id)) {
            visited.add(current.id);
            const parent = getParent(current);
            if (!parent) break;
            current = parent;
            depth++;
        }

        return depth;
    }

    /**
     * Returns a set of levels present in a collection of elements and/or relationships.
     * @param {jArchiCollection} concepts
     * @returns {Set<number>}
     */
    function getLevels(concepts) {
        return new Set(wrap(concepts).map(getLevel));
    }

    /**
     * Returns a set of levels that are present in all of the given collections.
     * @param {jArchiCollection} first 
     * @param  {...jArchiCollection} rest 
     * @returns {Set<number>}
     */
    function getSharedLevels(first, ...rest) {
        let shared = [...getLevels(first)];

        for (const next of rest) {
            shared = shared.filter(l => getLevels(next).has(l));
        }

        return new Set(shared);
    }

    /**
     * Determines the most frequent level in a collection.
     * @param {jArchiCollection} elements
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

    // --- HORIZONTAL RELATIONSHIPS ---

    /**
     * Gets elements that are the sources of relationships within the given scope,
     * pointing to the given targets, optionally filtered by source type.
     * @param {jArchiCollection|ArchiMateElement} targets - The target elements.
     * @param {jArchiCollection} scope - Relationships within scope.
     * @param {string} [sourceType] - Optional ArchiMate type to filter the sources.
     * @returns {jArchiCollection}
     */
    function getSources(targets, scope, sourceType = '*') {
        const targetIds = new Set(wrap(targets).map(e => e.id));
        return scope.filter(r => targetIds.has(r.target.id)).sourceEnds(sourceType);
    }

    /**
     * Gets elements that are the targets of relationships within the given scope,
     * originating from the given sources, optionally filtered by a target type.
     * @param {jArchiCollection|ArchiMateElement} sources - The source elements.
     * @param {jArchiCollection} scope - Relationships within scope.
     * @param {string} [targetType] - Optional ArchiMate type to filter the targets.
     * @returns {jArchiCollection}
     */
    function getTargets(sources, scope, targetType = '*') {
        const sourceIds = new Set(wrap(sources).map(e => e.id));
        return scope.filter(r => sourceIds.has(r.source.id)).targetEnds(targetType);
    }

    /**
     * Checks if a direct relationship within the given scope exists between two sets of elements.
     * @param {jArchiCollection} source
     * @param {jArchiCollection} target
     * @param {jArchiCollection} scope - Relationships within scope.
     * @returns {boolean}
     */
    function hasRelationship(source, target, scope) {
        return isOverlapping(getTargets(source, scope), target);
    }

    /**
     * Implements a breadth-first search (BFS) to determine reachability between elements.
     * Used for cycle detection and verifying indirect dependencies across a graph.
     * @param {ArchiMateElement} source - Starting node.
     * @param {ArchiMateElement|string} targetCriteria - Target element or ArchiMate type string.
     * @param {jArchiCollection} scope - The set of relationships allowed for traversal.
     * @returns {boolean}
     */
    function canReach(source, targetCriteria, scope) {
        const queue = [source];
        const visited = new Set([source.id]);
        const isTypeSearch = typeof targetCriteria === 'string';
        const targetId = isTypeSearch ? null : targetCriteria.id;

        while (queue.length > 0) {
            const current = queue.shift();

            // Check if we reached the target
            // (Exclude the source itself when searching by type)
            if (isTypeSearch) {
                if (current.id !== source.id && current.type === targetCriteria) return true;
            } else {
                if (current.id === targetId) return true;
            }

            // Explore neighbors using the provided scope
            getTargets(current, scope).each(neighbor => {
                if (!visited.has(neighbor.id)) {
                    visited.add(neighbor.id);
                    queue.push(neighbor);
                }
            });
        }
        return false;
    }

    /**
     * Filters a collection by allowed levels.
     * @param {jArchiCollection}
     * @param {Set<number>}
     * @returns {jArchiCollection}
     */
    function filterByLevel(collection, levels) {
        return collection.filter(c => levels.has(getLevel(c)));
    }

    /**
     * Filters relationships for progressive validation based on level adjacency.
     * @param {collectijArchiCollectionon} relationships
     * @param {number} offset (-1 for parent layer, 1 for child layer)
     * @returns {jArchiCollection}
     */
    function filterByLevelOffset(relationships, offset) {
        const buckets = {};
        relationships.each(r => {
            const key = r.source.type + "->" + r.target.type;
            if (!buckets[key]) buckets[key] = new Set();
            buckets[key].add(getLevel(r));
        });

        return relationships.filter(r => {
            const key = r.source.type + "->" + r.target.type;
            const currentLevel = getLevel(r);
            return buckets[key].has(currentLevel) && buckets[key].has(currentLevel + offset);
        });
    }

    // --- VIEW & CONTEXT ---

    /**
     * Segregates a raw collection of ArchiMate concepts into a structured context object.
     * Categorizes elements and relationships based on types defined in config.js.
     * @param {jArchiCollection} collection - Raw input from a view or selection.
     * @returns {Object} context containing categorized sub-collections.
     */
    function buildContext(collection) {
        const rawElements = collection.filter('element');
        const rawRelationships = collection.filter('relationship');

        const context = {
            elements: _EMPTY.clone(),
            streams: _EMPTY.clone(),
            capabilities: _EMPTY.clone(),
            objects: _EMPTY.clone(),
            relationships: _EMPTY.clone(),
            isRefinedBy: _EMPTY.clone(),
            horizontalRelationships: _EMPTY.clone(),
            precedes: _EMPTY.clone(),
            enables: _EMPTY.clone(),
            isBasedOn: _EMPTY.clone(),
            isManifestedBy: _EMPTY.clone(),
            transforms: _EMPTY.clone()
        };

        const configuredTypes = Object.entries(config.TYPES).map(([_, v]) => v);

        rawElements.each(e => {
            if (!configuredTypes.includes(e.type)) return;
            context.elements.add(e);
            switch (e.type) {
                case config.TYPES.stream: context.streams.add(e); break;
                case config.TYPES.capability: context.capabilities.add(e); break;
                case config.TYPES.object: context.objects.add(e); break
            }
        });

        rawRelationships.each(r => {
            if (!configuredTypes.includes(r.source.type) || !configuredTypes.includes(r.target.type)) return;
            context.relationships.add(r);

            if (r.type === config.TYPES.refinement) {
                context.isRefinedBy.add(r);
            } else {
                context.horizontalRelationships.add(r);

                const s = r.source.type;
                const t = r.target.type;
                if (s === t) {
                    switch (s) {
                        case config.TYPES.stream: context.precedes.add(r); break;
                        case config.TYPES.capability: context.enables.add(r); break;
                        case config.TYPES.object: context.isBasedOn.add(r); break;
                    }
                } else if (s === config.TYPES.capability && t === config.TYPES.stream) {
                    context.isManifestedBy.add(r);
                } else if (s === config.TYPES.capability && t === config.TYPES.object) {
                    context.transforms.add(r);
                }
            }
        });

        for (const key of Object.keys(context)) {
            context[key] = getUniqueConcepts(context[key]);
        }

        return context;
    }

    /**
     * Heuristic for identifying an Object Domain View and returning the domain header.
     * Criteria: Exactly two abstraction levels present, with a single dominant 'Domain Object' at the top level.
     * @param {Object} context - The context of the view.
     * @returns {ArchiMateElement|undefined} The identified Domain Header concept (high-level object).
     */
    function identifyDomainHeader(context) {
        const levels = getLevels(context.objects);
        const highestLevel = Math.min(...getLevels(context.objects));
        const highestObjects = context.objects.filter(e => getLevel(e) === highestLevel);
        if (context.isBasedOn.size() > 0 && levels.size === 2 && highestObjects.size() === 1) return highestObjects.first();
    }

    /**
     * Returns the singular top-level value stream if present in the context.
     * @param {Object} context 
     * @returns {ArchiMateElement|undefined}
     */
    function getTopValueStream(context) {
        const topStreams = getRoots(context.streams);
        if (topStreams.size() === 1) return topStreams.first();
    }

    /**
     * Finds the absolute position (left and right) of a visual object.
     * @param {VisualObject} object 
     * @returns {Array<number>}
     */
    function getHorizontalSpan(object) {
        let current = object;
        let left = 0
        while (current.bounds) {
            left += current.bounds.x;
            current = $(current).parent().first();
        }
        return [left, left + object.bounds.width];
    }

    /**
     * Derives 'Value Stage Zones' using spatial/geometric heuristics.
     * Groups elements based on horizontal overlap with value stream stages.
     * @param {jArchiCollection} views - A collection of diagrams to analyze.
     * @returns {Array<Object>} List of zones with names, view references, and local contexts.
     */
    function getValueStageZones(views) {
        const valueStageZones = [];

        views.each(view => {
            const allVisualElements = $(view).find('element');
            if (allVisualElements.size() === 0) return;

            const viewLevel = Math.max(...getLevels(getUniqueConcepts(allVisualElements)));
            const visualStages = allVisualElements.find(config.TYPES.stream)
                .filter(s => getLevel(s.concept) === viewLevel)
                .map(s => {
                    const [left, right] = getHorizontalSpan(s);
                    return { 
                        name: s.name,
                        left: left, 
                        right: right, 
                        elements: _EMPTY.clone()
                    };
                })
                .sort((a, b) => a.left - b.left);

            if (visualStages.length === 0) return;

            allVisualElements.each(e => {
                if (getLevel(e.concept) !== viewLevel) return;
                const [l, r] = getHorizontalSpan(e);
                for (const s of visualStages) if (l < s.right && r > s.left) s.elements.add(e);
            });

            for (const s of visualStages) {
                if (s.elements.size() === 0) return;
                const ids = s.elements.map(e => e.id);
                const stageRels = s.elements.rels().filter(r => ids.includes(r.source.id) && ids.includes(r.target.id));
                const stageContext = buildContext(s.elements.add(stageRels));
                valueStageZones.push({
                    name: s.name, 
                    viewName: view.name, 
                    context: stageContext
                });
            }
        });

        return valueStageZones;
    }

    return {
        // Core utilities
        isRelationship: isRelationship,

        // Set operations
        isOverlapping: isOverlapping,

        // Vertical structure
        getParent: getParent,
        hasMultipleParents: hasMultipleParents,
        getChildren: getChildren,
        isLeaf: isLeaf,
        getRoot: getRoot,
        getRoots: getRoots,
        getLevel: getLevel,
        getLevels: getLevels,
        getSharedLevels: getSharedLevels,
        getDominantDepth: getDominantDepth,

        // Horizontal structure
        getSources: getSources,
        getTargets: getTargets,
        hasRelationship: hasRelationship,
        canReach: canReach,
        filterByLevel: filterByLevel,
        filterByLevelOffset: filterByLevelOffset,

        // View & context
        buildContext: buildContext,
        identifyDomainHeader: identifyDomainHeader,
        getTopValueStream: getTopValueStream,
        getValueStageZones: getValueStageZones,
    };

})();
