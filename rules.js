// Helper to standardize output
function createResult(ruleId, violations) {
    return {
        id: ruleId,
        violations: violations
    };
}

const Rules = [
    {
        id: 'C0',
        name: 'Valid level',
        statement: 'Each element must be assigned a level that corresponds to its number of ancestors.',
        validate: function(context) {
            const violations = context.elements.filter(e => parseInt(GraphUtils.getLevel(e)) !== GraphUtils.getAncestorCount(e));
            return createResult(this.id, violations);
        }
    },
    {
        id: 'C1',
        name: 'Unique parent',
        statement: 'Each element has at most one parent.',
        validate: function(context) {
            const violations = context.elements.filter(e => GraphUtils.getParents(e).size() > 1);
            return createResult(this.id, violations);
        }
    },
    {
        id: 'C2',
        name: 'Acyclicity',
        statement: 'An element cannot be its own ancestor.',
        validate: function(context) {
            const violations = context.elements.filter(GraphUtils.isOwnAncestor);
            return createResult(this.id, violations);
        }
    },
    {
        id: 'C3',
        name: 'Consistent refinement depth',
        statement: 'All leaf elements (elements without children) must have the same number of ancestors.',
        validate: function(context) {
            const leafs = context.elements.filter(GraphUtils.isLeaf);

            const depthCounts = {};
            leafs.each(e => {
                const level = GraphUtils.getLevel(e);
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

            const violations = leafs.filter(e => GraphUtils.getLevel(e) !== dominantDepth);
            return createResult(this.id, violations);
        }
    },
    {
        id: 'C4',
        name: 'Upward coherence',
        statement: 'A non-hierarchical relationship between two elements requires a corresponding relationship between their parents (if any), provided the parents are distinct and with one exception: the relationship does not need to be propagated if the parent elements are both primary capabilities within the same top-level value stream.',
        validate: function(context) {
            const violations = context.relationships
                .filter(r => !(r.type === RELATIONS.refinement.type && r.source.type === r.target.type)) // exclude refinement relationships
                .filter(r => GraphUtils.getAncestorCount(r.source) > 0 || GraphUtils.getAncestorCount(r.target) > 0) // exclude top-level relations
                .filter(r => {
                    const sourceTopVSIDs = GraphUtils.getDirectlySupportedTopValueStreams(r.source);
                    const targetTopVSIDs = GraphUtils.getDirectlySupportedTopValueStreams(r.target);
                    const sameValueStream = Array.from(sourceTopVSIDs).some(sourceID => targetTopVSIDs.has(sourceID));
                    return !sameValueStream; // support relationships between primary capabilities within the same value stream are left implicit
                })
                .filter(r =>{
                    const sourceParent = GraphUtils.getParent(r.source);
                    const targetParent = GraphUtils.getParent(r.target);
                    if (!sourceParent || !targetParent) return true;
                    if (sourceParent.id === targetParent.id) return false; // no need for reflexive relations
                    
                    const parentRelExists = $(sourceParent).outRels(r.type).targetEnds().filter(tp => tp.id === targetParent.id).size() > 0;
                    
                    return !parentRelExists;
               });
            return createResult(this.id, violations);
        }
    },
    {
        id: 'C5',
        name: 'Downward coherence',
        statement: 'A relationship between two parent elements requires that at least one pair of their respective children (if any) is also related.',
        validate: function(context) {
            const violations = context.relationships
                .filter(r => !(r.type === RELATIONS.refinement.type && r.source.type === r.target.type)) // exclude refinement relationships
                .filter(r => GraphUtils.getChildren(r.source).size() > 0 || GraphUtils.getChildren(r.target).size() > 0) // Bottom-level relations have no opporunity for violation
                .filter(r => {
                    const sourceChildren = GraphUtils.getChildren(r.source);
                    const targetChildren = GraphUtils.getChildren(r.target);

                    // One of them is a leaf
                    if (sourceChildren.size() < 1 || targetChildren.size() < 1) return true;
                    
                    // At least one relationship of type r.type should go from a sourceChild to a targetChild.
                    const numberOfChildRels = sourceChildren.outRels(r.type).targetEnds().filter(tc => 
                        targetChildren.filter(ttc => ttc.id === tc.id).size() > 0
                    ).size();
                    
                    return numberOfChildRels < 1;
                });
            return createResult(this.id, violations);
        }
    },
    {
        id: 'C6',
        name: 'Capability Impact',
        statement: 'Each business capability must transform exactly one business object, with one exception: at the leaf level it may transform multiple objects.',
        validate: function(context) {
            let capabilities = context.capabilities;
            if (PARTIAL_SELECTION) {
                capabilities = GraphUtils.filterToUsedLevels(capabilities, GraphUtils.getTransformingCapabilities, context.objects)
            }
            const violations = capabilities.filter(e => {
                const objectCount = GraphUtils.getTransformedObjects(e).size();
                return objectCount < 1 || objectCount > 1 && !GraphUtils.isLeaf(e)
            });
            return createResult(this.id, violations);
        }
    },
    {
        id: 'C7',
        name: 'Object Relevance',
        statement: 'Each business object must be transformed by exactly one business capability, with one exception: at the leaf level, an object may be transformed by multiple capabilities.',
        validate: function(context) {
            let objects = context.objects;
            if (PARTIAL_SELECTION) {
                objects = GraphUtils.filterToUsedLevels(objects, GraphUtils.getTransformedObjects, context.capabilities)
            }
            const violations = objects.filter(e => {
                const capabilityCount = GraphUtils.getTransformingCapabilities(e).size();
                return capabilityCount < 1 || capabilityCount > 1 && !GraphUtils.isLeaf(e);
            });
            return createResult(this.id, violations);
        }
    },
    {
        id: 'C8',
        name: 'Capability Purpose',
        statement: 'Each capability must either directly realize a value stream stage or support another capability that does.',
        validate: function(context) {
            let capabilities = context.capabilities;
            if (PARTIAL_SELECTION) {
                capabilities = GraphUtils.filterToUsedLevels(capabilities, GraphUtils.getManifestedCapabilities, context.valueStreams)
            }
            const violations = capabilities.filter(e => !GraphUtils.supportsValueStream(e));
            return createResult(this.id, violations);
        }
    },
    {
        id: 'C9',
        name: 'Traceability',
        statement: 'Each value stream stage must be realized by exactly one capability.',
        validate: function(context) {
            let valueStreams = context.valueStreams;
            if (PARTIAL_SELECTION) {
                valueStreams = GraphUtils.filterToUsedLevels(valueStreams, GraphUtils.getManifestingValueStreams, context.capabilities)
            }
            const violations = valueStreams.filter(e => GraphUtils.getManifestedCapabilities(e).size() !== 1);
            return createResult(this.id, violations);
        }
    },
    {
        id: 'C10',
        name: 'Exclusive Manifestation',
        statement: 'Each capability may manifest only once as primary per top-level value stream, with an exception for the leaf-level.',
        validate: function(context) {
            let capabilities = context.capabilities;
            if (PARTIAL_SELECTION) {
                capabilities = GraphUtils.filterToUsedLevels(capabilities, GraphUtils.getManifestedCapabilities, context.valueStreams)
            }
            const violations = capabilities.filter(e =>
                GraphUtils.getChildren(e).size() !== 0 // exclude the leaf-level
                && GraphUtils.getManifestingValueStreams(e).size() !== GraphUtils.getDirectlySupportedTopValueStreams(e).size
            );
            return createResult(this.id, violations);
        }
    },
];
