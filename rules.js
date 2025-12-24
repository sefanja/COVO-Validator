var rules = (function() {

    return function(config, utils) {
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
                    const violations = leafs.filter(e => utils.getLevel(e) !== dominantDepth);
                    return {id: this.id, violations: violations};
                }
            },
            {
                id: 'C4',
                name: 'Upward coherence',
                statement: 'A non-hierarchical relationship between two elements requires a corresponding relationship between their parents (if any), provided the parents are distinct and with one exception: the relationship does not need to be propagated if the parent elements are both primary capabilities within the same top-level value stream.',
                validate: function(context) {
                    let horizontalRelations = context.horizontalRelations;
                    if (context.partial) {
                        const buckets = {};
                        horizontalRelations.each(r => {
                            const kind = config.getKind(r);
                            const level = utils.getLevel(r.source);
                            if (!buckets[kind]) buckets[kind] = new Set();
                            buckets[kind].add(level);
                        });
                        horizontalRelations = horizontalRelations.filter(r => {
                            const allLevels = buckets[config.getKind(r)];
                            const thisLevel = utils.getLevel(r.source);
                            return allLevels.has(thisLevel) && allLevels.has(thisLevel - 1);
                        });
                    }

                    const violations = horizontalRelations.filter(r => {
                        if (utils.getLevel(r.source) === 0 && utils.getLevel(r.target) === 0) return false; // exclude top-level relations

                        const sameTopLevelValueStream = utils.overlapping(
                            utils.getTopLevelValueStreams(r.source),
                            utils.getTopLevelValueStreams(r.target)
                        );
                        if (sameTopLevelValueStream) return false; // support relationships between primary capabilities within the same value stream are left implicit

                        const sourceParent = utils.getParent(r.source);
                        const targetParent = utils.getParent(r.target);

                        if (!sourceParent || !targetParent) return true;
                        if (utils.overlapping(sourceParent, targetParent)) return false; // no need for reflexive relations
                        
                        const parentRelExists = utils.overlapping($(sourceParent).outRels(r.type).targetEnds(), targetParent);
                        
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
                    let horizontalRelations = context.horizontalRelations;
                    if (context.partial) {
                        const buckets = {};
                        horizontalRelations.each(r => {
                            const kind = config.getKind(r);
                            const level = utils.getLevel(r.source);
                            if (!buckets[kind]) buckets[kind] = new Set();
                            buckets[kind].add(level);
                        });
                        horizontalRelations = horizontalRelations.filter(r => {
                            const allLevels = buckets[config.getKind(r)];
                            const thisLevel = utils.getLevel(r.source);
                            return allLevels.has(thisLevel) && allLevels.has(thisLevel + 1);
                        });
                    }

                    const violations = horizontalRelations.filter(r => {
                        if (utils.isLeaf(r.source) && utils.isLeaf(r.target)) return false;
                        if (utils.isLeaf(r.source) || utils.isLeaf(r.target)) return true;

                        const childRelExists = utils.overlapping(
                            utils.getChildren(r.source).outRels(r.type).targetEnds(),
                            utils.getChildren(r.target)
                        );

                        return !childRelExists;
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
                    if (context.partial) capabilities = utils.filterByRelatedLevels(capabilities, context.objects);

                    const violations = capabilities.filter(e => {
                        const objectCount = utils.getTargets(config.RELATIONS.transformation, e).size();
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
                    if (context.partial) objects = utils.filterByRelatedLevels(objects, context.capabilities);

                    const violations = objects.filter(e => {
                        const capabilityCount = utils.getSources(config.RELATIONS.transformation, e).size();
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
                    if (context.partial) capabilities = utils.filterByRelatedLevels(capabilities, context.valueStreams);

                    const violations = capabilities.filter(e => !utils.manifestsAsValueStreamTransitively(e));

                    return {id: this.id, violations: violations};
                }
            },
            {
                id: 'C9',
                name: 'Traceability',
                statement: 'Each value stream stage must be realized by exactly one capability.',
                validate: function(context) {
                    let valueStreams = context.valueStreams;
                    if (context.partial) valueStreams = utils.filterByRelatedLevels(valueStreams, context.capabilities);

                    const violations = valueStreams.filter(e => utils.getSources(config.RELATIONS.manifestation, e).size() !== 1);

                    return {id: this.id, violations: violations};
                }
            },
            {
                id: 'C10',
                name: 'Exclusive manifestation',
                statement: 'Each capability may manifest only once as primary per top-level value stream, with an exception for the leaf-level.',
                validate: function(context) {
                    let capabilities = context.capabilities;
                    if (context.partial) capabilities = utils.filterByRelatedLevels(capabilities, context.valueStreams);

                    const violations = capabilities.filter(e =>
                        !utils.isLeaf(e) // exclude the leaf-level
                        && utils.getTargets(config.RELATIONS.manifestation, e).size() > utils.getTopLevelValueStreams(e).size()
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
                    if (context.partial) {
                        elements = $();
                        config.getHorizontalReflexiveRelationKinds().forEach(kind => {
                            const levels = utils.getLevels(utils.filterRelationshipsByKind(context.relationships, kind).ends());
                            elements.add(context.elements.filter(e => e.type === kind.sourceType && levels.includes(utils.getLevel(e))));
                        });
                    }

                    const buckets = {}; // key = RootID + "_" + Level
                    elements.each(e => {
                        const key = utils.getRoot(e).id + "_L" + utils.getLevel(e);
                        if (!buckets[key]) buckets[key] = $();
                        buckets[key].add(e);
                    });

                    const violations = $();
                    Object.values(buckets).forEach(nodes => {
                        if (!utils.connected(nodes)) violations.add(nodes);
                    });

                    return {id: this.id, violations: violations};
                }
            },
            {
                id: 'C12',
                name: 'Compartmentalization',
                statement: 'A relationship between elements of the same type is not allowed if they belong to different top-level elements.',
                validate: function(context) {
                    const violations = context.horizontalReflexiveRelations.filter(utils.crossesBoundary);
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
                        const materialLevels = utils.getLevels(context.materialRelations.ends());
                        supportRelations = supportRelations.filter(r => materialLevels.includes(utils.getLevel(r.source)) || materialLevels.includes(utils.getLevel(r.target)));
                    }

                    const violations = supportRelations.filter(r =>
                        !utils.relationshipExists(config.RELATIONS.material,
                            utils.getTargets(config.RELATIONS.transformation, !config.RELATIONS.support.inverse ? r.target : r.source),
                            utils.getTargets(config.RELATIONS.transformation, !config.RELATIONS.support.inverse ? r.source : r.target)
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
                        const manifestationLevels = utils.getLevels(context.manifestationRelations.ends());
                        const transformationLevels = utils.getLevels(context.transformationRelations.ends());
                        const relevantLevels = manifestationLevels.filter(l => transformationLevels.includes(l)); // levels having a path from value stream to object
                        successionRelations = successionRelations.filter(r => relevantLevels.includes(utils.getLevel(r.source)) || relevantLevels.includes(utils.getLevel(r.target)))
                    }

                    const violations = successionRelations.filter(r =>
                        !utils.relationshipExists(config.RELATIONS.material,
                            utils.getTargets(config.RELATIONS.transformation, utils.getSources(config.RELATIONS.manifestation, !config.RELATIONS.succession.inverse ? r.target : r.source)),
                            utils.getTargets(config.RELATIONS.transformation, utils.getSources(config.RELATIONS.manifestation, !config.RELATIONS.succession.inverse ? r.source : r.target)),
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
                        const transformationLevels = utils.getLevels(context.transformationRelations.ends());
                        const supportLevels = utils.getLevels(context.supportRelations.ends());
                        const manifestationLevels = utils.getLevels(context.manifestationRelations.ends());
                        const successionLevels = utils.getLevels(context.successionRelations.ends());
                        const relevantLevels = transformationLevels.filter(l => supportLevels.includes(l) && manifestationLevels.includes(l) && successionLevels.includes(l));
                        materialRelations = materialRelations.filter(r => relevantLevels.includes(utils.getLevel(r.source)));
                    }

                    const violations = materialRelations.filter(r => {
                        const srcObj = !config.RELATIONS.material.inverse ? r.source : r.target;
                        const tgtObj = !config.RELATIONS.material.inverse ? r.target : r.source;

                        const srcCaps = utils.getSources(config.RELATIONS.transformation, srcObj);
                        const tgtCaps = utils.getSources(config.RELATIONS.transformation, tgtObj);

                        if (utils.overlapping(srcCaps, tgtCaps)) return false; // (1) same capability

                        const supportedCaps = utils.getTargets(config.RELATIONS.support, tgtCaps);

                        if (utils.overlapping(supportedCaps, srcCaps)) return false; // (2) support relation

                        const srcStages = utils.getTargets(config.RELATIONS.manifestation, srcCaps);
                        const tgtStages = utils.getTargets(config.RELATIONS.manifestation, tgtCaps);
                        const sucStages = utils.getTargets(config.RELATIONS.succession, tgtStages);

                        if (utils.overlapping(sucStages, srcStages)) return false; // (3) succeeding stages

                        return true;
                    });

                    return {id: this.id, violations: violations};
                }
            },
        ];
    }

})();
