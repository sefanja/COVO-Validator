const utils = (function() {
    
    // Prevents double wrapping
    function wrap (obj) {
        return obj && typeof obj.size === 'function' ? obj : $(obj);
    }

    // Get elements related to obj
    function getEnds(obj, rel, getTargets) {
        const coll = wrap(obj);
        const objType = coll.first() ? coll.first().type : null;
        const elementType = (getTargets ? rel.targetType : rel.sourceType) || objType;

        if (getTargets && !rel.inverse || !getTargets && rel.inverse) {
            return coll.outRels(rel.type).targetEnds(elementType);
        } else {
            return coll.inRels(rel.type).sourceEnds(elementType);
        }
    }

    function getLevel(obj) {
        return wrap(obj).prop(PROPERTIES.level);
    }

    function getTransformedObjects(obj) {
        return getEnds(obj, RELATIONS.transformation, true);
    }

    function getTransformingCapabilities(obj) {
        return getEnds(obj, RELATIONS.transformation, false);
    }

    function getManifestingValueStreams(obj) {
        return getEnds(obj, RELATIONS.manifestation, true);
    }

    function getManifestedCapabilities(obj) {
        return getEnds(obj, RELATIONS.manifestation, false);
    }

    function getSupportedCapabilities(obj) {
        return getEnds(obj, RELATIONS.support, true);
    }

    function getSupportingCapabilities(obj) {
        return getEnds(obj, RELATIONS.support, false);
    }

    function getParents(obj) {
        return getEnds(obj, RELATIONS.refinement, false);
    }

    function getParent(obj) {
        return getParents(obj).first();
    }

    function getRoot(obj) {
        let current = obj;
        const visited = new Set(); // prevent loops

        while (!visited.has(current.id)) {
            visited.add(current.id);
            const parent = getParent(current);
            if (!parent) return current;
            current = parent;
        }
    }

    function getChildren(obj) {
        return getEnds(obj, RELATIONS.refinement, true);
    }

    function isLeaf(obj) {
        return getChildren(obj).size() === 0;
    }

    function getAncestorCount(obj) {
        var count = 0;
        var current = obj;
        var visited = new Set();
        
        while (!visited.has(current.id)) {
            visited.add(current.id);
            var parent = getParent(current);
            if (!parent) break;
            current = parent;
            count++;
        }
        return count;
    }

    function isOwnAncestor(obj) {
        let current = obj;
        const initialId = obj.id;
        
        while (true) {
            const parent = getParent(current);
            if (!parent) break;
            if (parent.id === initialId) return true;
            current = parent;
        }
        return false;
    }

    // Checks if a capability (directly or transitively) supports a value stream
    function supportsValueStream(obj) {
        const queue = [obj];
        const visited = new Set([obj.id]); // prevent loops

        while (queue.length > 0) {
            const currentCapability = queue.shift();

            // Direct manifestation by a value stream found
            const valueStreams = getManifestingValueStreams(currentCapability);
            if (valueStreams.size() > 0) {
                return true;
            }

            // Add supported capabilities to the queue
            const supportedCapabilities = getSupportedCapabilities(currentCapability);
            supportedCapabilities.each(supportedCap => {
                if (!visited.has(supportedCap.id)) {
                    visited.add(supportedCap.id);
                    queue.push(supportedCap);
                }
            });
        }
        return false;
    }

    /**
     * Calculates the total number of unique top-level (L0) value streams
     * a capability is manifested in (directly or indirectly).
     */
    function getDirectlySupportedTopValueStreams(obj) {
        const valueStreams = getManifestingValueStreams(obj);
        const topStreamIDs = new Set();
        valueStreams.each(vs => {
            const root = getRoot(vs);
            if (root) topStreamIDs.add(root.id);
        });
        return topStreamIDs;
    }

    function filterToUsedLevels(coll, fun, relatedColl) {
        const levels = new Set(fun(relatedColl).map(GraphUtils.getLevel));
        return coll.filter(e => levels.has(GraphUtils.getLevel(e)));
    }

    return {
        getLevel: getLevel,
        getTransformedObjects: getTransformedObjects,
        getTransformingCapabilities: getTransformingCapabilities,
        getManifestingValueStreams: getManifestingValueStreams,
        getManifestedCapabilities: getManifestedCapabilities,
        getSupportedCapabilities: getSupportedCapabilities,
        getSupportingCapabilities: getSupportingCapabilities,
        getParents: getParents,
        getParent: getParent,
        getRoot: getRoot,
        getChildren: getChildren,
        isLeaf: isLeaf,
        getAncestorCount: getAncestorCount,
        isOwnAncestor: isOwnAncestor,
        supportsValueStream: supportsValueStream,
        getDirectlySupportedTopValueStreams: getDirectlySupportedTopValueStreams,
        filterToUsedLevels: filterToUsedLevels
    }

})();
