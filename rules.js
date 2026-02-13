var rules = (function() {

    return [
        {
            id: 'C1',
            name: 'Unique parent',
            validate: function(covoModel, strict = true) {
                // DETERMINE SCOPE
                const scope = covoModel.elements;

                // IDENTIFY VIOLATIONS
                const violations = scope.filter(utils.hasMultipleParents);

                return violations;
            }
        },
        {
            id: 'C2',
            name: 'Acyclicity',
            validate: function(covoModel, strict = true) {
                // DETERMINE SCOPE
                const scope = covoModel.isRefinedBy;

                // IDENTIFY VIOLATIONS
                const violations = scope.filter(r => utils.canReach(r.target, r.source, covoModel.isRefinedBy));

                return violations;
            }
        },
        {
            id: 'C3',
            name: 'Consistent refinement depth',
            validate: function(covoModel, strict = true) {
                // DETERMINE SCOPE
                const scope = covoModel.elements.filter(utils.isLeaf);

                // IDENTIFY VIOLATIONS
                const dominantDepth = utils.getDominantDepth(scope);
                const violations = scope.filter(e => utils.getLevel(e) !== dominantDepth);

                return violations;
            }
        },
        {
            id: 'C4',
            name: 'Upward coherence',
            validate: function(covoModel, strict = true) {
                // DETERMINE SCOPE
                let scope = covoModel.horizontalRelationships.filter(r =>
                    !(r.source.type === config.TYPES.object && r.target.type === config.TYPES.object) // exclude objects
                );

                if (!strict) {
                    // Only same-type relationships with adjacent levels
                    scope = utils.filterByLevelOffset(scope, -1);

                    // Exclude enabelement relations if we cannot check for the top-level value stream exception
                    const manifestationLevels = utils.getLevels(covoModel.isManifestedBy);
                    scope = scope.filter(r =>
                        r.source.type === config.TYPES.capability && r.target.type === config.TYPES.capability
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

                    if (r.source.type === config.TYPES.capability && r.target.type === config.TYPES.capability) {
                        // Exception if both parents are principal
                        // TODO: within a common value stream
                        if (utils.isOverlapping(
                            utils.getRoots(utils.getTargets(pSrc, covoModel.isManifestedBy)),
                            utils.getRoots(utils.getTargets(pTgt, covoModel.isManifestedBy))
                        )) return false;
                        // Exception for enablement cycles
                        if (utils.canReach(pTgt, pSrc, covoModel.enables)) return false;
                    }

                    if (r.source.type === config.TYPES.stream && r.target.type === config.TYPES.stream) {
                        // Exception for precedence cycles
                        if (utils.canReach(pTgt, pSrc, covoModel.precedes)) return false;
                        // Exception for redunant precedence paths
                        if (utils.canReach(pSrc, pTgt, covoModel.precedes)) return false;
                    }

                    // Find matching parent relation
                    return covoModel.horizontalRelationships.filter(pR =>
                        pR.type === r.type
                        && pR.source.id === pSrc.id
                        && pR.target.id === pTgt.id
                    ).size() === 0;
                });

                return violations;
            }
        },
        {
            id: 'C5',
            name: 'Downward coherence',
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
            validate: function(covoModel, strict = true) {
                // DETERMINE SCOPE
                let scope = covoModel.capabilities.clone();

                if (!strict) {
                    scope = utils.filterByLevel(scope, utils.getSharedLevels(covoModel.enables, covoModel.isManifestedBy));
                }

                // IDENTIFY VIOLATIONS
                const violations = scope.filter(e => !utils.canReach(e, config.TYPES.stream, covoModel.enables.clone().add(covoModel.isManifestedBy)));

                return violations;
            }
        },
        {
            id: 'C9',
            name: 'Traceability',
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
            name: 'Value stream-driven dependencies',
            validate: function(covoModel, strict = true) {
                // DETERMINE SCOPE
                let scope = covoModel.precedes.clone();

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
            name: 'Capability-driven dependencies',
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
            name: 'Grounded dependencies',
            validate: function(covoModel, strict = true) {
                // DETERMINE SCOPE
                let scope = covoModel.isBasedOn.clone();

                if (!strict) {
                    scope = utils.filterByLevel(scope, utils.getSharedLevels(covoModel.transforms, covoModel.enables, covoModel.isManifestedBy, covoModel.precedes));
                }

                // IDENTIFY VIOLATIONS
                const violations = scope.filter(r => {
                    const srcCaps = utils.getSources(r.source, covoModel.transforms);
                    const tgtCaps = utils.getSources(r.target, covoModel.transforms);
                    if (utils.isOverlapping(srcCaps, tgtCaps)) return false ; // (1) same capability

                    const enabledCaps = utils.getTargets(tgtCaps, covoModel.enables);
                    if (utils.isOverlapping(enabledCaps, srcCaps)) return false; // (2) enablement

                    const srcStages = utils.getTargets(srcCaps, covoModel.isManifestedBy);
                    const tgtStages = utils.getTargets(tgtCaps, covoModel.isManifestedBy);
                    const sucStages = utils.getTargets(tgtStages, covoModel.precedes);
                    if (utils.isOverlapping(sucStages, srcStages)) return false; // (3) precedence

                    return true;
                });

                return violations;
            }
        },
        {
            id: 'V1',
            name: 'Completeness',
            validate: function(covoModel, referenceCovoModel) {
                // TODO: wrong/unexpected validation results
                const violations = $();
                const lowestLevel = Math.max(...utils.getLevels(covoModel.elements));
                const lowestElements = covoModel.elements.filter(e => utils.getLevel(e) === lowestLevel);
                const lowestRelationships = covoModel.horizontalRelationships.filter(r => utils.getLevel(r) === lowestLevel);
                const configuredTypes = Object.entries(config.TYPES).map(([_, v]) => v);
                configuredTypes.forEach(t1 => {
                    const elementsOfType = lowestElements.filter(t1);
                    if (elementsOfType.size() > 0) {
                        violations.add(referenceCovoModel.elements.filter(e => utils.getLevel(e) === lowestLevel && e.type === t1).not(elementsOfType));
                    }
                    configuredTypes.forEach(t2 => {
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
            validate: function(covoModel, referenceCovoModel) {
                return covoModel.elements.clone().add(covoModel.horizontalRelationships).not(referenceCovoModel.concepts);
            }
        }
    ];

})();
