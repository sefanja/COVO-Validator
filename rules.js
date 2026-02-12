var rules = (function() {

    return [
        {
            id: 'C1',
            name: 'Unique parent',
            validate: function(context, strict = true) {
                // DETERMINE SCOPE
                const scope = context.elements;

                // IDENTIFY VIOLATIONS
                const violations = scope.filter(utils.hasMultipleParents);

                return violations;
            }
        },
        {
            id: 'C2',
            name: 'Acyclicity',
            validate: function(context, strict = true) {
                // DETERMINE SCOPE
                const scope = context.isRefinedBy;

                // IDENTIFY VIOLATIONS
                const violations = scope.filter(r => utils.canReach(r.target, r.source, context.isRefinedBy));

                return violations;
            }
        },
        {
            id: 'C3',
            name: 'Consistent refinement depth',
            validate: function(context, strict = true) {
                // DETERMINE SCOPE
                const scope = context.elements.filter(utils.isLeaf);

                // IDENTIFY VIOLATIONS
                const dominantDepth = utils.getDominantDepth(scope);
                const violations = scope.filter(e => utils.getLevel(e) !== dominantDepth);

                return violations;
            }
        },
        {
            id: 'C4',
            name: 'Upward coherence',
            validate: function(context, strict = true) {
                // DETERMINE SCOPE
                let scope = context.horizontalRelationships.filter(r =>
                    !(r.source.type === config.TYPES.object && r.target.type === config.TYPES.object) // exclude objects
                );

                if (!strict) {
                    // Only same-type relationships with adjacent levels
                    scope = utils.filterByLevelOffset(scope, -1);

                    // Exclude enabelement relations if we cannot check for the top-level value stream exception
                    const manifestationLevels = utils.getLevels(context.isManifestedBy);
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
                            utils.getRoots(utils.getTargets(pSrc, context.isManifestedBy)),
                            utils.getRoots(utils.getTargets(pTgt, context.isManifestedBy))
                        )) return false;
                        // Exception for enablement cycles
                        if (utils.canReach(pTgt, pSrc, context.enables)) return false;
                    }

                    if (r.source.type === config.TYPES.stream && r.target.type === config.TYPES.stream) {
                        // Exception for precedence cycles
                        if (utils.canReach(pTgt, pSrc, context.precedes)) return false;
                        // Exception for redunant precedence paths
                        if (utils.canReach(pSrc, pTgt, context.precedes)) return false;
                    }

                    // Find matching parent relation
                    return context.horizontalRelationships.filter(pR =>
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
            validate: function(context, strict = true) {
                // DETERMINE SCOPE
                let scope = context.horizontalRelationships.clone();

                if (!strict) scope = utils.filterByLevelOffset(scope, 1);

                // IDENTIFY VIOLATIONS
                const violations = scope.filter(r => {
                    // Both leafs or one leaf
                    if (utils.isLeaf(r.source) && utils.isLeaf(r.target)) return false;
                    if (utils.isLeaf(r.source) || utils.isLeaf(r.target)) return true;

                    // Find matching child relation
                    return context.horizontalRelationships.filter(cR =>
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
            validate: function(context, strict = true) {
                // DETERMINE SCOPE
                let scope = context.capabilities.clone();

                if (!strict) scope = utils.filterByLevel(scope, utils.getLevels(context.transforms));

                // IDENTIFY VIOLATIONS
                const violations = scope.filter(e => {
                    const objectCount = utils.getTargets(e, context.transforms).size();
                    return utils.isLeaf(e) ? (objectCount < 1) : (objectCount !== 1);
                });

                return violations;
            }
        },
        {
            id: 'C7',
            name: 'Object relevance',
            validate: function(context, strict = true) {
                // DETERMINE SCOPE
                let scope = context.objects.clone();

                if (!strict) scope = utils.filterByLevel(scope, utils.getLevels(context.transforms));

                // IDENTIFY VIOLATIONS
                const violations = scope.filter(e => {
                    const capabilityCount = utils.getSources(e, context.transforms).size();
                    return utils.isLeaf(e) ? (capabilityCount < 1) : (capabilityCount !== 1);
                });

                return violations;
            }
        },
        {
            id: 'C8',
            name: 'Capability purpose',
            validate: function(context, strict = true) {
                // DETERMINE SCOPE
                let scope = context.capabilities.clone();

                if (!strict) {
                    scope = utils.filterByLevel(scope, utils.getSharedLevels(context.enables, context.isManifestedBy));
                }

                // IDENTIFY VIOLATIONS
                const violations = scope.filter(e => !utils.canReach(e, config.TYPES.stream, context.enables.clone().add(context.isManifestedBy)));

                return violations;
            }
        },
        {
            id: 'C9',
            name: 'Traceability',
            validate: function(context, strict = true) {
                // DETERMINE SCOPE
                let scope = context.streams.clone();

                if (!strict) scope = utils.filterByLevel(scope, utils.getLevels(context.isManifestedBy));

                // IDENTIFY VIOLATIONS
                const violations = scope.filter(e => utils.getSources(e, context.isManifestedBy).size() !== 1);

                return violations;
            }
        },
        {
            id: 'C10',
            name: 'Exclusive manifestation',
            validate: function(context, strict = true) {
                // DETERMINE SCOPE
                let scope = context.capabilities.clone();

                if (!strict) scope = utils.filterByLevel(scope, utils.getLevels(context.isManifestedBy));

                // IDENTIFY VIOLATIONS
                const violations = scope.filter(e => {
                    const streams = utils.getTargets(e, context.isManifestedBy);
                    return !utils.isLeaf(e) && streams.size() > utils.getRoots(streams).size();
                });

                return violations;
            }
        },
        {
            id: 'C11',
            name: 'Value stream-driven dependencies',
            validate: function(context, strict = true) {
                // DETERMINE SCOPE
                let scope = context.precedes.clone();

                if (!strict) {
                    scope = utils.filterByLevel(scope, utils.getSharedLevels(context.isManifestedBy, context.transforms));
                }

                // IDENTIFY VIOLATIONS
                const violations = scope.filter(r => {
                    const sObj = utils.getTargets(utils.getSources(r.source, context.isManifestedBy), context.transforms);
                    const tObj = utils.getTargets(utils.getSources(r.target, context.isManifestedBy), context.transforms);
                    return !utils.isOverlapping(sObj, tObj) && !utils.hasRelationship(tObj, sObj, context.isBasedOn);
                });

                return violations;
            }
        },
        {
            id: 'C12',
            name: 'Capability-driven dependencies',
            validate: function(context, strict = true) {
                // DETERMINE SCOPE
                let scope = context.enables.clone();

                if (!strict) {
                    scope = utils.filterByLevel(scope, utils.getSharedLevels(context.transforms, context.isBasedOn));
                }

                // IDENTIFY VIOLATIONS
                const violations = scope.filter(r => {
                    const sObj = utils.getTargets(r.source, context.transforms);
                    const tObj = utils.getTargets(r.target, context.transforms);
                    return !utils.isOverlapping(sObj, tObj) && !utils.hasRelationship(tObj, sObj, context.isBasedOn);
                });

                return violations;
            }
        },
        {
            id: 'C13',
            name: 'Grounded dependencies',
            validate: function(context, strict = true) {
                // DETERMINE SCOPE
                let scope = context.isBasedOn.clone();

                if (!strict) {
                    scope = utils.filterByLevel(scope, utils.getSharedLevels(context.transforms, context.enables, context.isManifestedBy, context.precedes));
                }

                // IDENTIFY VIOLATIONS
                const violations = scope.filter(r => {
                    const srcCaps = utils.getSources(r.source, context.transforms);
                    const tgtCaps = utils.getSources(r.target, context.transforms);
                    if (utils.isOverlapping(srcCaps, tgtCaps)) return false ; // (1) same capability

                    const enabledCaps = utils.getTargets(tgtCaps, context.enables);
                    if (utils.isOverlapping(enabledCaps, srcCaps)) return false; // (2) enablement

                    const srcStages = utils.getTargets(srcCaps, context.isManifestedBy);
                    const tgtStages = utils.getTargets(tgtCaps, context.isManifestedBy);
                    const sucStages = utils.getTargets(tgtStages, context.precedes);
                    if (utils.isOverlapping(sucStages, srcStages)) return false; // (3) precedence

                    return true;
                });

                return violations;
            }
        },
        {
            id: 'V1',
            name: 'Completeness',
            validate: function(context, referenceContext) {
                // TODO: wrong/unexpected validation results
                const violations = $();
                const lowestLevel = Math.max(...utils.getLevels(context.elements));
                const lowestElements = context.elements.filter(e => utils.getLevel(e) === lowestLevel);
                const lowestRelationships = context.horizontalRelationships.filter(r => utils.getLevel(r) === lowestLevel);
                const configuredTypes = Object.entries(config.TYPES).map(([_, v]) => v);
                configuredTypes.forEach(t1 => {
                    const elementsOfType = lowestElements.filter(t1);
                    if (elementsOfType.size() > 0) {
                        violations.add(referenceContext.elements.filter(e => utils.getLevel(e) === lowestLevel && e.type === t1).not(elementsOfType));
                    }
                    configuredTypes.forEach(t2 => {
                        const relationshipsOfType = lowestRelationships.filter(r => [t1, t2].includes(r.source.type) && [t1, t2].includes(r.target.type));
                        if (relationshipsOfType.size() > 0) {
                            violations.add(referenceContext.horizontalRelationships.filter(r => utils.getLevel(r) === lowestLevel && [t1, t2].includes(r.source.type) && [t1, t2].includes(r.target.type)).not(relationshipsOfType));
                        }
                    })
                });
                return violations;
            }
        },
        {
            id: 'V2',
            name: 'Justification',
            validate: function(context, referenceContext) {
                return context.elements.clone().add(context.horizontalRelationships).not(referenceContext.elements.clone().add(referenceContext.horizontalRelationships));
            }
        }
    ];

})();
