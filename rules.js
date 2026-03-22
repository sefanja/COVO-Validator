var rules = (function() {

    return [
        {
            id: 'C1',
            name: 'Unique parent',
            advice: 'Remove a relationship with one of its parents.',
            validate: function(covoModel) {
                return covoModel.elements.filter(utils.hasMultipleParents);
            }
        },
        {
            id: 'C2',
            name: 'Acyclicity',
            advice: 'Remove a parent-child relationship to break the cycle.',
            validate: function(covoModel) {
                return covoModel.isRefinedBy.filter(r => utils.canReach(r.target, r.source, covoModel.isRefinedBy));
            }
        },
        {
            id: 'C3',
            name: 'Consistent refinement depth',
            advice: 'Either remove or complete the lowest-level elements.',
            validate: function(covoModel) {
                const leafs = covoModel.elements.filter(utils.isLeaf);
                const dominantDepth = utils.getDominantDepth(leafs);
                return leafs.filter(e => utils.getLevel(e) !== dominantDepth);
            }
        },
        {
            id: 'C4',
            name: 'Upward coherence',
            advice: 'Add a corresponding relationship between the parent elements.',
            validate: function(covoModel, strict = true) {
                // DETERMINE SCOPE
                let scope = covoModel.horizontalRelationships.filter(r =>
                    !(r.source.type === config.ELEMENT_TYPES.object && r.target.type === config.ELEMENT_TYPES.object) // exclude objects
                );

                if (!strict) {
                    // Only same-type relationships with adjacent levels
                    scope = utils.filterByLevelOffset(scope, -1);

                    // Exclude enabelement relations if we cannot check for the top-level value stream exception
                    const manifestationLevels = utils.getLevels(covoModel.isManifestedBy);
                    scope = scope.filter(r =>
                        r.source.type === config.ELEMENT_TYPES.capability && r.target.type === config.ELEMENT_TYPES.capability
                        ? manifestationLevels.has(utils.getLevel(r))
                        : true);
                }

                // IDENTIFY VIOLATIONS
                const violations = scope.filter(r => {
                    const pSrc = utils.getParent(r.source);
                    const pTgt = utils.getParent(r.target);

                    // No parents, only one parent, or same parent
                    if (!pSrc && !pTgt) return false;
                    if (!pSrc || !pTgt) return true;
                    if (pSrc.id === pTgt.id) return false;

                    if (r.source.type === config.ELEMENT_TYPES.capability && r.target.type === config.ELEMENT_TYPES.capability) {
                        // Exception if both parents are principal
                        if (utils.isOverlapping(
                            utils.getRoots(utils.getTargets(pSrc, covoModel.isManifestedBy)),
                            utils.getRoots(utils.getTargets(pTgt, covoModel.isManifestedBy))
                        )) return false;
                        // Exception for enablement cycles
                        if (utils.canReach(pTgt, pSrc, covoModel.enables)) return false;
                    }

                    if (r.source.type === config.ELEMENT_TYPES.stream && r.target.type === config.ELEMENT_TYPES.stream) {
                        // Exception for affect cycles
                        if (utils.canReach(pTgt, pSrc, covoModel.affects)) return false;
                        // Exception for redunant affect paths
                        if (utils.canReach(pSrc, pTgt, covoModel.affects)) return false;
                    }

                    // Find matching parent relationship
                    return covoModel.horizontalRelationships.filter(pR =>
                        pR.source.id === pSrc.id
                        && pR.target.id === pTgt.id
                        && (r.type !== config.REL_TYPES.coManifestsFor || r.type === pR.type)
                    ).size() === 0;
                });

                return violations;
            }
        },
        {
            id: 'C5',
            name: 'Downward coherence',
            advice: 'Add a corresponding relationship between one of their children.',
            validate: function(covoModel, strict = true) {
                // DETERMINE SCOPE
                let scope = covoModel.horizontalRelationships.clone();

                if (!strict) scope = utils.filterByLevelOffset(scope, 1);

                // IDENTIFY VIOLATIONS
                const violations = scope.filter(r => {
                    // Both leafs or one leaf
                    if (utils.isLeaf(r.source) && utils.isLeaf(r.target)) return false;
                    if (utils.isLeaf(r.source) || utils.isLeaf(r.target)) return true;

                    // Find matching child relation
                    return covoModel.horizontalRelationships.filter(cR =>
                        cR.type === r.type
                        && utils.isOverlapping(cR.source, utils.getChildren(r.source))
                        && utils.isOverlapping(cR.target, utils.getChildren(r.target))
                    ).size() === 0;
                });

                return violations;
            }
        },
        {
            id: 'C6',
            name: 'Capability impact',
            advice: 'Link each capability to an object.',
            validate: function(covoModel, strict = true) {
                // DETERMINE SCOPE
                let scope = covoModel.capabilities.clone();

                if (!strict) scope = utils.filterByLevel(scope, utils.getLevels(covoModel.transforms));

                // IDENTIFY VIOLATIONS
                const violations = scope.filter(e => {
                    const objectCount = utils.getTargets(e, covoModel.transforms).size();
                    return utils.isLeaf(e) ? (objectCount < 1) : (objectCount !== 1);
                });

                return violations;
            }
        },
        {
            id: 'C7',
            name: 'Object relevance',
            advice: 'Link each object to a capability.',
            validate: function(covoModel, strict = true) {
                // DETERMINE SCOPE
                let scope = covoModel.objects.clone();

                if (!strict) scope = utils.filterByLevel(scope, utils.getLevels(covoModel.transforms));

                // IDENTIFY VIOLATIONS
                const violations = scope.filter(e => {
                    const capabilityCount = utils.getSources(e, covoModel.transforms).size();
                    return utils.isLeaf(e) ? (capabilityCount < 1) : (capabilityCount !== 1);
                });

                return violations;
            }
        },
        {
            id: 'C8',
            name: 'Capability purpose',
            advice: 'Link each capability to a value stream, either directly or indirectly through other capabilities.',
            validate: function(covoModel, strict = true) {
                // DETERMINE SCOPE
                let scope = covoModel.capabilities.clone();

                if (!strict) {
                    scope = utils.filterByLevel(scope, utils.getSharedLevels(covoModel.enables, covoModel.isManifestedBy));
                }

                // IDENTIFY VIOLATIONS
                const violations = scope.filter(e => !utils.canReach(e, config.ELEMENT_TYPES.stream, covoModel.enables.clone().add(covoModel.isManifestedBy)));

                return violations;
            }
        },
        {
            id: 'C9',
            name: 'Traceability',
            advice: 'Link each value stream (stage) to exactly one capability.',
            validate: function(covoModel, strict = true) {
                // DETERMINE SCOPE
                let scope = covoModel.streams.clone();

                if (!strict) scope = utils.filterByLevel(scope, utils.getLevels(covoModel.isManifestedBy));

                // IDENTIFY VIOLATIONS
                const violations = scope.filter(e => utils.getSources(e, covoModel.isManifestedBy).size() !== 1);

                return violations;
            }
        },
        {
            id: 'C10',
            name: 'Exclusive manifestation',
            advice: 'Merge the stages that manifest the same principal capability.',
            validate: function(covoModel, strict = true) {
                // DETERMINE SCOPE
                let scope = covoModel.capabilities.clone();

                if (!strict) scope = utils.filterByLevel(scope, utils.getLevels(covoModel.isManifestedBy));

                // IDENTIFY VIOLATIONS
                const violations = scope.filter(e => {
                    const streams = utils.getTargets(e, covoModel.isManifestedBy);
                    return !utils.isLeaf(e) && streams.size() > utils.getRoots(streams).size();
                });

                return violations;
            }
        },
        {
            id: 'C11',
            name: 'Grounded value stream dependencies',
            advice: 'Add a corresponding object relationship.',
            validate: function(covoModel, strict = true) {
                // DETERMINE SCOPE
                let scope = covoModel.affects.clone();

                if (!strict) {
                    scope = utils.filterByLevel(scope, utils.getSharedLevels(covoModel.isManifestedBy, covoModel.transforms));
                }

                // IDENTIFY VIOLATIONS
                const violations = scope.filter(r => {
                    const sObj = utils.getTargets(utils.getSources(r.source, covoModel.isManifestedBy), covoModel.transforms);
                    const tObj = utils.getTargets(utils.getSources(r.target, covoModel.isManifestedBy), covoModel.transforms);
                    return !utils.isOverlapping(sObj, tObj) && !utils.hasRelationship(tObj, sObj, covoModel.isBasedOn);
                });

                return violations;
            }
        },
        {
            id: 'C12',
            name: 'Grounded capability dependencies',
            advice: 'Add a corresponding object relationship.',
            validate: function(covoModel, strict = true) {
                // DETERMINE SCOPE
                let scope = covoModel.enables.clone();

                if (!strict) {
                    scope = utils.filterByLevel(scope, utils.getSharedLevels(covoModel.transforms, covoModel.isBasedOn));
                }

                // IDENTIFY VIOLATIONS
                const violations = scope.filter(r => {
                    const sObj = utils.getTargets(r.source, covoModel.transforms);
                    const tObj = utils.getTargets(r.target, covoModel.transforms);
                    return !utils.isOverlapping(sObj, tObj) && !utils.hasRelationship(tObj, sObj, covoModel.isBasedOn);
                });

                return violations;
            }
        },
        {
            id: 'C13',
            name: 'Justified object dependencies',
            advice: 'Add a corresponding stage or capability relationship.',
            validate: function(covoModel, strict = true) {
                // DETERMINE SCOPE
                let scope = covoModel.isBasedOn.clone();

                if (!strict) {
                    scope = utils.filterByLevel(scope, utils.getSharedLevels(covoModel.transforms, covoModel.enables, covoModel.isManifestedBy, covoModel.affects));
                }

                // IDENTIFY VIOLATIONS
                const violations = scope.filter(r => {
                    const srcCaps = utils.getSources(r.source, covoModel.transforms);
                    const tgtCaps = utils.getSources(r.target, covoModel.transforms);
                    if (utils.isOverlapping(srcCaps, tgtCaps)) return false ; // (1) same capability

                    const enabledCaps = utils.getTargets(tgtCaps, covoModel.enables);
                    if (utils.isOverlapping(enabledCaps, srcCaps)) return false; // (2) enables

                    const srcStages = utils.getTargets(srcCaps, covoModel.isManifestedBy);
                    const tgtStages = utils.getTargets(tgtCaps, covoModel.isManifestedBy);
                    const sucStages = utils.getTargets(tgtStages, covoModel.affects);
                    if (utils.isOverlapping(sucStages, srcStages)) return false; // (3) affects

                    return true;
                });

                return violations;
            }
        },
        {
            id: 'V1',
            name: 'Completeness',
            advice: 'Add these concepts to the view.',
            validate: function(covoModel, referenceCovoModel) {
                const violations = $();
                const lowestLevel = Math.max(...utils.getLevels(covoModel.elements));
                const lowestElements = covoModel.elements.filter(e => utils.getLevel(e) === lowestLevel);
                const lowestRelationships = covoModel.horizontalRelationships.filter(r => utils.getLevel(r) === lowestLevel);
                const configuredElementTypes = Object.entries(config.ELEMENT_TYPES).map(([_, v]) => v);
                configuredElementTypes.forEach(t1 => {
                    const elementsOfType = lowestElements.filter(t1);
                    if (elementsOfType.size() > 0) {
                        violations.add(referenceCovoModel.elements.filter(e => utils.getLevel(e) === lowestLevel && e.type === t1).not(elementsOfType));
                    }
                    configuredElementTypes.forEach(t2 => {
                        const relationshipsOfType = lowestRelationships.filter(r => r.source.type === t1 && r.target.type === t2);
                        if (relationshipsOfType.size() > 0) {
                            violations.add(referenceCovoModel.horizontalRelationships.filter(r => utils.getLevel(r) === lowestLevel && r.source.type === t1 && r.target.type === t2).not(relationshipsOfType));
                        }
                    })
                });
                return violations;
            }
        },
        {
            id: 'V2',
            name: 'Justification',
            advice: 'Remove these concepts from the view.',
            validate: function(covoModel, referenceCovoModel) {
                return covoModel.elements.clone().add(covoModel.horizontalRelationships).not(referenceCovoModel.concepts);
            }
        }
    ];

})();
