var rules = (function() {

    return [
        {
            id: 'C1',
            name: 'Unique parent',
            statement: 'Each element has at most one parent.',
            validate: function(context) {
                const violations = context.elements.filter(utils.hasMultipleParents);
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
                const dominantDepth = utils.getDominantDepth(leafs);
                const violations = leafs.filter(e => utils.getLevel(e) !== dominantDepth); // blame the exceptions
                return {id: this.id, violations: violations};
            }
        },
        {
            id: 'C4',
            name: 'Upward coherence',
            statement: 'A non-hierarchical relationship between two elements requires a corresponding relationship between their parents (if any), provided the parents are distinct and with one exception: the relationship does not need to be propagated if the parent elements are both primary capabilities within the same top-level value stream.', // TODO: ...or objects transformed by those primary capabilities.
            validate: function(context) {
                let horizontalRelations = context.horizontalRelations;
                if (context.partial) {
                    const transformationLevels = utils.getLevels(context.transformationRelations);
                    const manifestationLevels = utils.getLevels(context.manifestationRelations);
                    horizontalRelations = utils.filterByLevelAdjacency(horizontalRelations, -1).filter(r =>{
                        const currentLevel = utils.getLevel(r.source);
                        // these extra relationships are needed to check for the shared top-level value stream exception
                        if (r.source.type === config.TYPES.capability && r.target.type === config.TYPES.capability) {
                            return manifestationLevels.includes(currentLevel);
                        }
                        if (r.source.type === config.TYPES.object && r.target.type === config.TYPES.object) {
                            return manifestationLevels.includes(currentLevel) && transformationLevels.includes(currentLevel);
                        }
                        return true;
                    });
                }

                const violations = horizontalRelations.filter(r => {
                    const pSrc = utils.getParent(r.source);
                    const pTgt = utils.getParent(r.target);

                    // No parents, only one parent, or same parent
                    if (!pSrc && !pTgt) return false;
                    if (!pSrc || !pTgt) return true;
                    if (pSrc.id === pTgt.id) return false;

                    // Exception for primary capabilities in same top-level value stream
                    if (r.source.type === config.TYPES.capability && r.target.type === config.TYPES.capability) {
                        const sameTopLevelValueStream = utils.isOverlapping(
                            utils.getRoots(utils.getTargets(r.source, context.manifestationRelations)),
                            utils.getRoots(utils.getTargets(r.target, context.manifestationRelations))
                        );
                        if (sameTopLevelValueStream) return false;
                    }

                    // ... and their objects
                    if (r.source.type === config.TYPES.object && r.target.type === config.TYPES.object) {
                        const sameTopLevelValueStream = utils.isOverlapping(
                            utils.getRoots(utils.getTargets(utils.getSources(r.source, context.transformationRelations), context.manifestationRelations)),
                            utils.getRoots(utils.getTargets(utils.getSources(r.target, context.transformationRelations), context.manifestationRelations))
                        );
                        if (sameTopLevelValueStream) return false;
                    }

                    // Find matching parent relation
                    return context.horizontalRelations.filter(pR =>
                        pR.type === r.type
                        && pR.source.id === pSrc.id
                        && pR.target.id === pTgt.id
                    ).size() === 0;
                });

                return {id: this.id, violations: violations};
            }
        },
        {
            id: 'C5',
            name: 'Downward coherence',
            statement: 'A relationship between two parent elements requires that at least one pair of their respective children (if any) is also related.',
            validate: function(context) {
                let horizontalRelations = context.horizontalRelations;
                if (context.partial) horizontalRelations = utils.filterByLevelAdjacency(horizontalRelations, 1);

                const violations = horizontalRelations.filter(r => {
                    // No leafs or only one leaf
                    if (utils.isLeaf(r.source) && utils.isLeaf(r.target)) return false;
                    if (utils.isLeaf(r.source) || utils.isLeaf(r.target)) return true;

                    // Find matching child relation
                    return context.horizontalRelations.filter(cR =>
                        cR.type === r.type
                        && utils.isOverlapping(cR.source, utils.getChildren(r.source))
                        && utils.isOverlapping(cR.target, utils.getChildren(r.target))
                    ).size() === 0;
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
                if (context.partial) capabilities = utils.filterByLevel(capabilities, utils.getLevels(context.transformationRelations));

                const violations = capabilities.filter(e => {
                    const objectCount = utils.getTargets(e, context.transformationRelations).size();
                    return utils.isLeaf(e) ? (objectCount < 1) : (objectCount !== 1);
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
                if (context.partial) objects = utils.filterByLevel(objects, utils.getLevels(context.transformationRelations));

                const violations = objects.filter(e => {
                    const capabilityCount = utils.getSources(e, context.transformationRelations).size();
                    return utils.isLeaf(e) ? (capabilityCount < 1) : (capabilityCount !== 1);
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
                if (context.partial) capabilities = utils.filterByLevel(capabilities, utils.getLevels(context.manifestationRelations));

                const violations = capabilities.filter(e => !utils.isRelatedTransitively(e, context.horizontalRelations, config.TYPES.valueStream));

                return {id: this.id, violations: violations};
            }
        },
        {
            id: 'C9',
            name: 'Traceability',
            statement: 'Each value stream stage must be realized by exactly one capability.',
            validate: function(context) {
                let valueStreams = context.valueStreams;
                if (context.partial) valueStreams = utils.filterByLevel(valueStreams, utils.getLevels(context.manifestationRelations))

                const violations = valueStreams.filter(e => utils.getSources(e, context.manifestationRelations).size() !== 1);

                return {id: this.id, violations: violations};
            }
        },
        {
            id: 'C10',
            name: 'Exclusive manifestation',
            statement: 'Each capability may manifest only once as primary per top-level value stream, with an exception for the leaf-level.',
            validate: function(context) {
                let capabilities = context.capabilities;
                if (context.partial) capabilities = utils.filterByLevel(capabilities, utils.getLevels(context.manifestationRelations));

                const violations = capabilities.filter(e => {
                    const valueStreams = utils.getTargets(e, context.manifestationRelations);
                    return !utils.isLeaf(e) && valueStreams.size() > utils.getRoots(valueStreams).size();
                });

                return {id: this.id, violations: violations};
            }
        },
        {
            id: 'C11',
            name: 'Cohesion',
            statement: 'At each level, the descendants of a top-level element must form a connected graph.',
            validate: function(context) {
                let elements = context.elements;
                if (context.partial) {
                    elements = $();
                    Object.values(config.TYPES).forEach(type => {
                        elements.add(utils.filterByLevel(
                            context.elements.filter(type),
                            utils.getLevels(context.horizontalReflexiveRelations.filter(r => r.source.type === type))
                        ));
                    });
                }

                const buckets = {};
                elements.each(e => {
                    const key = utils.getRoot(e).id + '_L' + utils.getLevel(e);
                    if (!buckets[key]) buckets[key] = $();
                    buckets[key].add(e);
                });

                const violations = $();
                Object.values(buckets).forEach(nodes => {
                    if (!utils.isConnected(nodes, context.horizontalReflexiveRelations)) violations.add(nodes);
                });

                return {id: this.id, violations: violations};
            }
        },
        {
            id: 'C12',
            name: 'Compartmentalization',
            statement: 'A relationship between elements of the same type is not allowed if they belong to different top-level elements.',
            validate: function(context) {
                const violations = context.horizontalReflexiveRelations.filter(r => utils.getRoot(r.source).id !== utils.getRoot(r.target).id);
                return {id: this.id, violations: violations};
            }
        },
        {
            id: 'C13',
            name: 'Object dependency',
            statement: 'Each support relationship between capabilities must have a corresponding material relationship between objects.',
            validate: function(context) {
                let supportRelations = context.supportRelations;
                if (context.partial) {
                    const materialLevels = utils.getLevels(context.materialRelations);
                    supportRelations = supportRelations.filter(r => materialLevels.includes(utils.getLevel(r.source)));
                }

                const violations = supportRelations.filter(r =>
                    !utils.isRelated(
                        utils.getTargets(r.target, context.transformationRelations),
                        utils.getTargets(r.source, context.transformationRelations),
                        context.materialRelations
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
                let successionRelations = context.successionRelations;
                if (context.partial) {
                    const manifestationLevels = utils.getLevels(context.manifestationRelations);
                    const transformationLevels = utils.getLevels(context.transformationRelations);
                    const relevantLevels = manifestationLevels.filter(l => transformationLevels.includes(l));
                    successionRelations = successionRelations.filter(r => relevantLevels.includes(utils.getLevel(r.source)))
                }

                const violations = successionRelations.filter(r =>
                    !utils.isRelated(
                        utils.getTargets(utils.getSources(r.target, context.manifestationRelations), context.transformationRelations),
                        utils.getTargets(utils.getSources(r.source, context.manifestationRelations), context.transformationRelations),
                        context.materialRelations
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
                let materialRelations = context.materialRelations;
                if (context.partial) {
                    const transformationLevels = utils.getLevels(context.transformationRelations);
                    const supportLevels = utils.getLevels(context.supportRelations);
                    const manifestationLevels = utils.getLevels(context.manifestationRelations);
                    const successionLevels = utils.getLevels(context.successionRelations);
                    const relevantLevels = transformationLevels.filter(l => supportLevels.includes(l) && manifestationLevels.includes(l) && successionLevels.includes(l));
                    materialRelations = materialRelations.filter(r => relevantLevels.includes(utils.getLevel(r.source)));
                }

                const violations = materialRelations.filter(r => {
                    const srcCaps = utils.getSources(r.source, context.transformationRelations);
                    const tgtCaps = utils.getSources(r.target, context.transformationRelations);
                    if (utils.isOverlapping(srcCaps, tgtCaps)) return false; // (1) same capability

                    const supportedCaps = utils.getTargets(tgtCaps, context.supportRelations);
                    if (utils.isOverlapping(supportedCaps, srcCaps)) return false; // (2) support relation

                    const srcStages = utils.getTargets(srcCaps, context.manifestationRelations);
                    const tgtStages = utils.getTargets(tgtCaps, context.manifestationRelations);
                    const sucStages = utils.getTargets(tgtStages, context.successionRelations);
                    if (utils.isOverlapping(sucStages, srcStages)) return false; // (3) succeeding stages

                    return true;
                });

                return {id: this.id, violations: violations};
            }
        },
    ];

})();
