load(__DIR__ + 'utils.js');

const Rules = [
    {
        id: 'C0',
        name: 'Valid level',
        statement: 'Each element must be assigned a level that corresponds to its number of ancestors.',
        validate: function(context) {
            const violations = context.elements.filter(e => 
                parseInt(utils.getLevel(e)) !== utils.getAncestorCount(e)
            );
            return {id: this.id, violations: violations};
        }
    },
    {
        id: 'C1',
        name: 'Unique parent',
        statement: 'Each element has at most one parent.',
        validate: function(context) {
            const violations = context.elements.filter(e =>
                utils.getParents(e).size() > 1
            );
            return {id: this.id, violations: violations};
        }
    },
    {
        id: 'C2',
        name: 'Acyclicity',
        statement: 'An element cannot be its own ancestor.',
        validate: function(context) {
            const violations = context.elements.filter(utils.isOwnAncestor);
            return {id: this.id, violations: violations};
        }
    },
    {
        id: 'C3',
        name: 'Consistent refinement depth',
        statement: 'All leaf elements (elements without children) must have the same number of ancestors.',
        validate: function(context) {
            const leafs = context.elements.filter(utils.isLeaf);

            const depthCounts = {};
            leafs.each(e => {
                const level = utils.getLevel(e);
                depthCounts[level] = (depthCounts[level] || 0) + 1;
            });

            let maxCount = 0;
            let dominantDepth = null;
            for (const level in depthCounts) {
                if (depthCounts[level] > maxCount) {
                    maxCount = depthCounts[level];
                    dominantDepth = level;
                }
            }

            const violations = leafs.filter(e =>
                utils.getLevel(e) !== dominantDepth
            );

            return {id: this.id, violations: violations};
        }
    },
    {
        id: 'C4',
        name: 'Upward coherence',
        statement: 'A non-hierarchical relationship between two elements requires a corresponding relationship between their parents (if any), provided the parents are distinct and with one exception: the relationship does not need to be propagated if the parent elements are both primary capabilities within the same top-level value stream.',
        validate: function(context) {
            const violations = context.relationships.filter(r => {
                if (r.type === RELATIONS.refinement.type && r.source.type === r.target.type) return false; // exclude refinement relationships

                if (utils.getAncestorCount(r.source) === 0 && utils.getAncestorCount(r.target) === 0) return false; // exclude top-level relations

                const sourceTopVSIDs = utils.getDirectlySupportedTopValueStreams(r.source);
                const targetTopVSIDs = utils.getDirectlySupportedTopValueStreams(r.target);
                const sameValueStream = Array.from(sourceTopVSIDs).some(sourceID => targetTopVSIDs.has(sourceID));
                if (sameValueStream) return false; // support relationships between primary capabilities within the same value stream are left implicit

                const sourceParent = utils.getParent(r.source);
                const targetParent = utils.getParent(r.target);
                if (!sourceParent || !targetParent) return true;
                if (sourceParent.id === targetParent.id) return false; // no need for reflexive relations
                
                const parentRelExists = $(sourceParent).outRels(r.type).targetEnds().filter(tp => tp.id === targetParent.id).size() > 0;
                
                return !parentRelExists;
            });

            return {id: this.id, violations: violations};
        }
    },
    {
        id: 'C5',
        name: 'Downward coherence',
        statement: 'A relationship between two parent elements requires that at least one pair of their respective children (if any) is also related.',
        validate: function(context) {
            const violations = context.relationships.filter(e => {
                if (r.type === RELATIONS.refinement.type && r.source.type === r.target.type) return false; // exclude refinement relationships
                if (utils.getChildren(r.source).size() === 0 && utils.getChildren(r.target).size() === 0) return false; // bottom-level relations have no opporunity for violation

                const sourceChildren = utils.getChildren(r.source);
                const targetChildren = utils.getChildren(r.target);

                if (sourceChildren.size() < 1 || targetChildren.size() < 1) return true; // one of them is a leaf

                // At least one relationship of type r.type should go from a sourceChild to a targetChild.
                const numberOfChildRels = sourceChildren.outRels(r.type).targetEnds().filter(tc => 
                    targetChildren.filter(ttc => ttc.id === tc.id).size() > 0
                ).size();
                
                return numberOfChildRels < 1;
            });

            return {id: this.id, violations: violations};
        }
    },
    {
        id: 'C6',
        name: 'Capability Impact',
        statement: 'Each business capability must transform exactly one business object, with one exception: at the leaf level it may transform multiple objects.',
        validate: function(context) {
            let capabilities = context.capabilities;
            if (context.partialSelection) {
                capabilities = utils.filterToUsedLevels(capabilities, utils.getTransformingCapabilities, context.objects)
            }

            const violations = capabilities.filter(e => {
                const objectCount = utils.getTransformedObjects(e).size();
                return objectCount < 1 || objectCount > 1 && !utils.isLeaf(e)
            });

            return {id: this.id, violations: violations};
        }
    },
    {
        id: 'C7',
        name: 'Object Relevance',
        statement: 'Each business object must be transformed by exactly one business capability, with one exception: at the leaf level, an object may be transformed by multiple capabilities.',
        validate: function(context) {
            let objects = context.objects;
            if (context.partialSelection) {
                objects = utils.filterToUsedLevels(objects, utils.getTransformedObjects, context.capabilities)
            }

            const violations = objects.filter(e => {
                const capabilityCount = utils.getTransformingCapabilities(e).size();
                return capabilityCount < 1 || capabilityCount > 1 && !utils.isLeaf(e);
            });

            return {id: this.id, violations: violations};
        }
    },
    {
        id: 'C8',
        name: 'Capability Purpose',
        statement: 'Each capability must either directly realize a value stream stage or support another capability that does.',
        validate: function(context) {
            let capabilities = context.capabilities;
            if (context.partialSelection) {
                capabilities = utils.filterToUsedLevels(capabilities, utils.getManifestedCapabilities, context.valueStreams)
            }

            const violations = capabilities.filter(e => !utils.supportsValueStream(e));

            return {id: this.id, violations: violations};
        }
    },
    {
        id: 'C9',
        name: 'Traceability',
        statement: 'Each value stream stage must be realized by exactly one capability.',
        validate: function(context) {
            let valueStreams = context.valueStreams;
            if (context.partialSelection) {
                valueStreams = utils.filterToUsedLevels(valueStreams, utils.getManifestingValueStreams, context.capabilities)
            }

            const violations = valueStreams.filter(e => utils.getManifestedCapabilities(e).size() !== 1);

            return {id: this.id, violations: violations};
        }
    },
    {
        id: 'C10',
        name: 'Exclusive Manifestation',
        statement: 'Each capability may manifest only once as primary per top-level value stream, with an exception for the leaf-level.',
        validate: function(context) {
            let capabilities = context.capabilities;
            if (context.partialSelection) {
                capabilities = utils.filterToUsedLevels(capabilities, utils.getManifestedCapabilities, context.valueStreams)
            }

            const violations = capabilities.filter(e =>
                utils.getChildren(e).size() !== 0 // exclude the leaf-level
                && utils.getManifestingValueStreams(e).size() !== utils.getDirectlySupportedTopValueStreams(e).size
            );

            return {id: this.id, violations: violations};
        }
    },
];
