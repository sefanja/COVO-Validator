const Rules = [
    {
        id: 'C0',
        name: 'Valid level',
        statement: 'Each element must be assigned a level that corresponds to its number of ancestors.',
        validate: function(context) {
            const violations = context.elements.filter(e => parseInt(utils.getLevel(e)) !== utils.getAncestorCount(e));
            return {id: this.id, violations: violations};
        }
    },
    {
        id: 'C1',
        name: 'Unique parent',
        statement: 'Each element has at most one parent.',
        validate: function(context) {
            const violations = context.elements.filter(e => utils.getParents(e).size() > 1);
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

            const violations = leafs.filter(e => utils.getLevel(e) !== dominantDepth);

            return {id: this.id, violations: violations};
        }
    },
    {
        id: 'C4',
        name: 'Upward coherence',
        statement: 'A non-hierarchical relationship between two elements requires a corresponding relationship between their parents (if any), provided the parents are distinct and with one exception: the relationship does not need to be propagated if the parent elements are both primary capabilities within the same top-level value stream.',
        validate: function(context) {
            const violations = context.relationships.filter(r => {
                if (utils.matchesRelationConfig(r, RELATIONS.refinement)) return false; // exclude refinement relationships

                if (utils.getAncestorCount(r.source) === 0 && utils.getAncestorCount(r.target) === 0) return false; // exclude top-level relations

                const sourceTopVS = utils.getDirectlySupportedTopValueStreams(r.source);
                const targetTopVS = utils.getDirectlySupportedTopValueStreams(r.target);
                const sameValueStream = utils.intersect(sourceTopVS, targetTopVS).size() > 0;
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
            const violations = context.relationships.filter(r => {
                if (utils.matchesRelationConfig(r, RELATIONS.refinement)) return false; // exclude refinement relationships
                if (utils.isLeaf(r.source) && utils.getChildren(r.target).size() === 0) return false; // bottom-level relations have no opporunity for violation

                const sourceChildren = utils.getChildren(r.source);
                const targetChildren = utils.getChildren(r.target);

                if (sourceChildren.size() < 1 || targetChildren.size() < 1) return true; // one of them is a leaf

                const numberOfChildRels = sourceChildren.outRels(r.type).targetEnds().filter(tc => 
                    targetChildren.filter(ttc => ttc.id === tc.id).size() > 0 // at least one relationship of type r.type should go from a sourceChild to a targetChild
                ).size();
                
                return numberOfChildRels < 1;
            });

            return {id: this.id, violations: violations};
        }
    },
    {
        id: 'C6',
        name: 'Capability impact',
        statement: 'Each business capability must transform exactly one business object, with one exception: at the leaf level it may transform multiple objects.',
        validate: function(context) {
            let capabilities = context.capabilities;
            if (context.partialSelection) capabilities = utils.filterByExistingLevels(capabilities, utils.getTransformingCapabilities, context.objects);

            const violations = capabilities.filter(e => {
                const objectCount = utils.getTransformedObjects(e).size();
                return objectCount < 1 || objectCount > 1 && !utils.isLeaf(e)
            });

            return {id: this.id, violations: violations};
        }
    },
    {
        id: 'C7',
        name: 'Object relevance',
        statement: 'Each business object must be transformed by exactly one business capability, with one exception: at the leaf level, an object may be transformed by multiple capabilities.',
        validate: function(context) {
            let objects = context.objects;
            if (context.partialSelection) objects = utils.filterByExistingLevels(objects, utils.getTransformedObjects, context.capabilities);

            const violations = objects.filter(e => {
                const capabilityCount = utils.getTransformingCapabilities(e).size();
                return capabilityCount < 1 || capabilityCount > 1 && !utils.isLeaf(e);
            });

            return {id: this.id, violations: violations};
        }
    },
    {
        id: 'C8',
        name: 'Capability purpose',
        statement: 'Each capability must either directly realize a value stream stage or support another capability that does.',
        validate: function(context) {
            let capabilities = context.capabilities;
            if (context.partialSelection) capabilities = utils.filterByExistingLevels(capabilities, utils.getManifestedCapabilities, context.valueStreams);

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
            if (context.partialSelection) valueStreams = utils.filterByExistingLevels(valueStreams, utils.getManifestingValueStreams, context.capabilities);

            const violations = valueStreams.filter(e => utils.getManifestedCapabilities(e).size() !== 1);

            return {id: this.id, violations: violations};
        }
    },
    {
        id: 'C10',
        name: 'Exclusive manifestation',
        statement: 'Each capability may manifest only once as primary per top-level value stream, with an exception for the leaf-level.',
        validate: function(context) {
            let capabilities = context.capabilities;
            if (context.partialSelection) capabilities = utils.filterByExistingLevels(capabilities, utils.getManifestedCapabilities, context.valueStreams);

            const violations = capabilities.filter(e =>
                !utils.isLeaf(e) // exclude the leaf-level
                && utils.getManifestingValueStreams(e).size() > utils.getDirectlySupportedTopValueStreams(e).size()
        );

            return {id: this.id, violations: violations};
        }
    },
    {
        id: 'C11',
        name: 'Cohesion',
        statement: 'At each level, the descendants of a top-level element must form a connected graph.',
        validate: function(context) {
            let elements = context.elements;
            if (context.partialSelection) {
                elements = $();
                RELATIONS.getHorizontalReflexiveRelations().forEach(rel => {
                    const levels = new Set(utils.filterRelation(context.relationships, rel).ends().map(utils.getLevel));
                    elements.add(context.elements.filter(e => e.type === rel.sourceType && levels.has(utils.getLevel(e))));
                });
            }

            const buckets = {}; // key = RootID + "_" + Level
            
            elements.each(e => {
                const key = utils.getRoot(e).id + "_L" + utils.getLevel(e);
                if (!buckets[key]) buckets[key] = [];
                buckets[key].push(e);
            });

            const violatingIDs = new Set();
            Object.keys(buckets).forEach(key => {
                const nodes = buckets[key];
                
                if (nodes.length <= 1) return; // a group of 0 or 1 is connected by definition

                const groupIds = new Set(nodes.map(n => n.id)); // for quick lookup
                
                const visited = new Set();
                const queue = [nodes[0]];
                visited.add(nodes[0].id);
                
                while (queue.length > 0) {
                    const current = queue.shift();
                    const neighbors = [];
                    utils.getSucceedingValueStreams(current).each(e => neighbors.push(e));
                    utils.getPreceedingValueStreams(current).each(e => neighbors.push(e));
                    
                    // add valid neighbours to queue
                    for (let i = 0; i < neighbors.length; i++) {
                        const neighbor = neighbors[i];
                        if (visited.has(neighbor.id)) continue;
                        if (groupIds.has(neighbor.id)) {
                            visited.add(neighbor.id);
                            queue.push(neighbor);
                        }
                    }
                }
                
                if (visited.size !== nodes.length) nodes.forEach(n => violatingIDs.add(n.id));
            });

            const violations = context.valueStreams.filter(e => violatingIDs.has(e.id));

            return {id: this.id, violations: violations};
        }
    },
    {
        id: 'C12',
        name: 'Compartmentalization',
        statement: 'A relationship between elements of the same type is not allowed if they belong to different top-level elements.',
        validate: function(context) {
            const violations = utils.filterRelation(context.relationships, RELATIONS.getHorizontalReflexiveRelations()).filter(r => utils.getRoot(r.source).id !== utils.getRoot(r.target).id);
            return {id: this.id, violations: violations};
        }
    },
    {
        id: 'C13',
        name: 'Object dependency',
        statement: 'Each support relationship between capabilities must have a corresponding material relationship between objects.',
        validate: function(context) {
            let supportRelations = context.support;
            if (context.partialSelection) {
                const materialLevels = new Set(context.material.ends().map(utils.getLevel));
                supportRelations = supportRelations.filter(r => materialLevels.has(utils.getLevel(r.source)) || materialLevels.has(utils.getLevel(r.target)));
            }

            const violations = supportRelations.filter(r =>
                !utils.relationExists(RELATIONS.material,
                    utils.getTransformedObjects(!RELATIONS.support.inverse ? r.target : r.source),
                    utils.getTransformedObjects(!RELATIONS.support.inverse ? r.source : r.target)
                )
            );

            return {id: this.id, violations: violations};
        }
    },
    {
        id: 'C14',
        name: 'Object flow',
        statement: 'Each succession relationship between value stream stages must have a corresponding material relationship between the objects transformed by their primary capabilities.',
        validate: function(context) {
            let successionRelations = context.succession;
            if (context.partialSelection) {
                const manifestationLevels = [new Set(context.manifestation.ends().map(utils.getLevel))];
                const transformationLevels = [new Set(context.transformation.ends().map(utils.getLevel))];
                const relevantLevels = manifestationLevels.filter(l => transformationLevels.includes(l)); // levels having a path from value stream to object
                successionRelations = successionRelations.filter(r => relevantLevels.includes(utils.getLevel(r.source)) || relevantLevels.includes(utils.getLevel(r.target)))
            }

            const violations = successionRelations.filter(r =>
                !utils.relationExists(RELATIONS.material,
                    utils.getTransformedObjects(utils.getManifestedCapabilities(!RELATIONS.succession.inverse ? r.target : r.source)),
                    utils.getTransformedObjects(utils.getManifestedCapabilities(!RELATIONS.succession.inverse ? r.source : r.target)),
                )
            );

            return {id: this.id, violations: violations};
        }
    },
    {
        id: 'C15',
        name: 'Grounded dependencies',
        statement: 'A material relationship between objects is only allowed if they are transformed (1) by the same capability, (2) by capabilities with a support relationship, or (3) by capabilities that are manifested by succeeding value stream stages.',
        validate: function(context) {
            const violations = context.material.filter(r => {
                const srcObj = !RELATIONS.material.inverse ? r.source : r.target;
                const tgtObj = !RELATIONS.material.inverse ? r.target : r.source;

                const srcCaps = utils.getTransformingCapabilities(srcObj);
                const tgtCaps = utils.getTransformingCapabilities(tgtObj);

                if (utils.intersect(srcCaps, tgtCaps).size() > 0) return false; // (1) same capability

                const supportedCaps = utils.getSupportedCapabilities(tgtCaps);

                if (utils.intersect(supportedCaps, srcCaps).size() > 0) return false; // (2) support relation

                const srcStages = utils.getManifestingValueStreams(srcCaps);
                const tgtStages = utils.getManifestingValueStreams(tgtCaps);
                const sucStages = utils.getSucceedingValueStreams(tgtStages);

                if (utils.intersect(sucStages, srcStages).size() > 0) return false; // (3) succeeding stages

                return true;
            });

            return {id: this.id, violations: violations};
        }
    },
];
