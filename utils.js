var utils = (function() {
    
    // Prevents double wrapping
    function wrap(objectOrCollection) {
        return objectOrCollection && typeof objectOrCollection.size === 'function' ? objectOrCollection : $(objectOrCollection);
    }

    const levelCache = {};
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

    function getLevels(elements) {
        return Array.from(new Set(wrap(elements).map(getLevel)));
    }

    function intersection(first, ...rest) {
        let result = wrap(first);
        for (const next of rest) {
            const IDs = wrap(next).map(e => e.id);
            result = result.filter(e => IDs.includes(e.id));
        }
        return result;
    }

    function overlapping(...concepts) {
        return intersection(...concepts).size() > 0;
    }

    function filterByRelatedLevels(collection1, collection2) {
        const levels = getLevels(intersection(collection1.rels().ends(), collection2));
        return collection1.filter(e => levels.includes(getLevel(e)));
    }

    function matchesRelationKind(relationship, kind) {
        const reflexive = !kind.sourceType && !kind.targetType;
        const rightRelationshipType = relationship.type === kind.type;
        const rightSourceType = reflexive && relationship.source.type === relationship.target.type || relationship.source.type === (!kind.inverse ? kind.sourceType : kind.targetType)
        const rightTargetType = reflexive && relationship.target.type === relationship.source.type || relationship.target.type === (!kind.inverse ? kind.targetType : kind.sourceType)
        return rightRelationshipType && rightSourceType && rightTargetType;
    }

    function filterRelationshipsByKind(relationships, ...kind) {
        return wrap(relationships).filter(r => kind.some(k => matchesRelationKind(r, k)));
    }

    function getEnds(relationKind, getTargets, elements) {
        const collection = wrap(elements);
        const elementType = collection.first() ? collection.first().type : null;
        const configElementType = (getTargets ? relationKind.targetType : relationKind.sourceType) || elementType;

        if (getTargets && !relationKind.inverse || !getTargets && relationKind.inverse) {
            return collection.outRels(relationKind.type).targetEnds(configElementType);
        } else {
            return collection.inRels(relationKind.type).sourceEnds(configElementType);
        }
    }

    function getTargets(relationKind, elements) {
        return getEnds(relationKind, true, elements);
    }

    function getSources(relationKind, elements) {
        return getEnds(relationKind, false, elements);
    }

    function relationshipExists(kind, sources, targets) {
        return overlapping(getTargets(kind, sources), targets);
    }

    function getParent(element) {
        return getSources(config.RELATIONS.refinement, element).first();
    }

    function hasMultipleParents(element) {
        return getSources(config.RELATIONS.refinement, element).size() > 1;
    }

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

    function getChildren(element) {
        return getTargets(config.RELATIONS.refinement, element);
    }

    function isLeaf(element) {
        return getChildren(element).size() === 0;
    }

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

    function manifestsAsValueStreamTransitively(element) {
        const queue = [element];
        const visited = new Set([element.id]);

        while (queue.length > 0) {
            const currentCapability = queue.shift();

            const valueStreams = getTargets(config.RELATIONS.manifestation, currentCapability);
            if (valueStreams.size() > 0) return true;

            const supportedCapabilities = getTargets(config.RELATIONS.support, currentCapability);
            supportedCapabilities.each(supportedCap => {
                if (!visited.has(supportedCap.id)) {
                    visited.add(supportedCap.id);
                    queue.push(supportedCap);
                }
            });
        }
        return false;
    }

    function crossesBoundary(r) {
        return !overlapping(getRoot(r.source), getRoot(r.target));
    }

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

        return dominantDepth
    }

    function getTopLevelValueStreams(capabilities) {
        const topLevelValueStreams = $();
        getTargets(config.RELATIONS.manifestation, capabilities).each(e => topLevelValueStreams.add(getRoot(e)))
        return topLevelValueStreams;
    }

    function connected(nodes) {
        if (nodes.length <= 1) return true; // a group of 0 or 1 is connected by definition

        const nodeIds = new Set(nodes.map(n => n.id)); // for quick lookup
        
        const visited = new Set();
        const queue = [nodes[0]];
        visited.add(nodes[0].id);
        
        while (queue.length > 0) {
            const current = queue.shift();
            const neighbors = [];
            filterRelationshipsByKind($(current).rels(), ...config.getHorizontalRelationKinds()).ends().each(e => neighbors.push(e));
            for (let i = 0; i < neighbors.length; i++) {
                const neighbor = neighbors[i];
                if (visited.has(neighbor.id)) continue;
                if (nodeIds.has(neighbor.id)) {
                    visited.add(neighbor.id);
                    queue.push(neighbor);
                }
            }
        }
        
        return visited.size === nodes.length;
    }

    function flash(concepts) {
        if (!config.FLASH.enabled) return;
        
        const collection = concepts.objectRefs();

        if (!collection || collection.size() === 0) return;

        // 1. Sla de originele staat op (zowel vulling als lijn)
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
        matchesRelationKind: matchesRelationKind,
        filterRelationshipsByKind: filterRelationshipsByKind,
        relationshipExists: relationshipExists,
        getLevel: getLevel,
        getLevels: getLevels,
        getTargets: getTargets,
        getSources: getSources,
        hasMultipleParents: hasMultipleParents,
        getParent: getParent,
        getRoot: getRoot,
        getChildren: getChildren,
        isLeaf: isLeaf,
        isOwnAncestor: isOwnAncestor,
        manifestsAsValueStreamTransitively: manifestsAsValueStreamTransitively,
        filterByRelatedLevels: filterByRelatedLevels,
        overlapping: overlapping,
        crossesBoundary: crossesBoundary,
        getDominantDepth: getDominantDepth,
        getTopLevelValueStreams: getTopLevelValueStreams,
        connected: connected,
        flash: flash,
        intersection: intersection
    }

})();
