var constraints = (function() {

    return [
        {
            id: 'C01',
            validate: function(covoModel) {
                return covoModel.elements.filter(utils.hasMultipleParents);
            },
            describe: 'Multiple parents'
        },
        {
            id: 'C02',
            validate: function(covoModel) {
                return covoModel.isRefinedBy.filter(r => utils.canReach(r.target, r.source, covoModel.isRefinedBy));
            },
            describe: 'Part of a cycle'
        },
        {
            id: 'C03',
            validate: function(covoModel) {
                const leafs = covoModel.elements.filter(utils.isLeaf);
                const dominantDepth = utils.getDominantDepth(leafs);
                return leafs.filter(e => utils.getLevel(e) !== dominantDepth);
            },
            describe: 'Leafs at a deviant refinement level'
        },
        {
            id: 'C04',
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
                return scope.filter(r => {
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
            },
            describe: 'Missing corresponding relationship between parents'
        },
        {
            id: 'C05',
            validate: function(covoModel, strict = true) {
                // DETERMINE SCOPE
                let scope = covoModel.horizontalRelationships.clone();

                if (!strict) scope = utils.filterByLevelOffset(scope, 1);

                // IDENTIFY VIOLATIONS
                return scope.filter(r => {
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
            },
            describe: 'Missing corresponding relationship between children'
        },
        {
            id: 'C06',
            validate: function(covoModel, strict = true) {
                // DETERMINE SCOPE
                let scope = covoModel.capabilities.clone();

                if (!strict) scope = utils.filterByLevel(scope, utils.getLevels(covoModel.transforms));

                // IDENTIFY VIOLATIONS
                return scope.filter(e => {
                    const objectCount = utils.getTargets(e, covoModel.transforms).size();
                    return utils.isLeaf(e) ? (objectCount < 1) : (objectCount !== 1);
                });
            },
            describe: 'Not linked to an object'
        },
        {
            id: 'C07',
            validate: function(covoModel, strict = true) {
                // DETERMINE SCOPE
                let scope = covoModel.objects.clone();

                if (!strict) scope = utils.filterByLevel(scope, utils.getLevels(covoModel.transforms));

                // IDENTIFY VIOLATIONS
                return scope.filter(e => {
                    const capabilityCount = utils.getSources(e, covoModel.transforms).size();
                    return utils.isLeaf(e) ? (capabilityCount < 1) : (capabilityCount !== 1);
                });
            },
            describe: 'Not linked to a capability'
        },
        {
            id: 'C08',
            validate: function(covoModel, strict = true) {
                // DETERMINE SCOPE
                let scope = covoModel.capabilities.clone();

                if (!strict) {
                    scope = utils.filterByLevel(scope, utils.getSharedLevels(covoModel.enables, covoModel.isManifestedBy));
                }

                // IDENTIFY VIOLATIONS
                return scope.filter(e => !utils.canReach(e, config.ELEMENT_TYPES.stream, covoModel.enables.clone().add(covoModel.isManifestedBy)));
            },
            describe: 'Not related to a value stream'
        },
        {
            id: 'C09',
            validate: function(covoModel, strict = true) {
                // DETERMINE SCOPE
                let scope = covoModel.streams.clone();

                if (!strict) scope = utils.filterByLevel(scope, utils.getLevels(covoModel.isManifestedBy));

                // IDENTIFY VIOLATIONS
                return scope.filter(e => utils.getSources(e, covoModel.isManifestedBy).size() !== 1);
            },
            describe: 'Linked to multiple capabilities'
        },
        {
            id: 'C10',
            validate: function(covoModel, strict = true) {
                // DETERMINE SCOPE
                let scope = covoModel.capabilities.clone();

                if (!strict) scope = utils.filterByLevel(scope, utils.getLevels(covoModel.isManifestedBy));

                // IDENTIFY VIOLATIONS
                return scope.filter(e => {
                    const streams = utils.getTargets(e, covoModel.isManifestedBy);
                    return !utils.isLeaf(e) && streams.size() > utils.getRoots(streams).size();
                });
            },
            describe: 'Linked to multiple stages'
        },
        {
            id: 'C11',
            validate: function(covoModel, strict = true) {
                // DETERMINE SCOPE
                let scope = covoModel.affects.clone();

                if (!strict) {
                    scope = utils.filterByLevel(scope, utils.getSharedLevels(covoModel.isManifestedBy, covoModel.transforms));
                }

                // IDENTIFY VIOLATIONS
                return scope.filter(r => {
                    const sObj = utils.getTargets(utils.getSources(r.source, covoModel.isManifestedBy), covoModel.transforms);
                    const tObj = utils.getTargets(utils.getSources(r.target, covoModel.isManifestedBy), covoModel.transforms);
                    return !utils.isOverlapping(sObj, tObj) && !utils.hasRelationship(tObj, sObj, covoModel.isBasedOn);
                });
            },
            describe: 'Missing corresponding object relationship'
        },
        {
            id: 'C12',
            validate: function(covoModel, strict = true) {
                // DETERMINE SCOPE
                let scope = covoModel.enables.clone();

                if (!strict) {
                    scope = utils.filterByLevel(scope, utils.getSharedLevels(covoModel.transforms, covoModel.isBasedOn));
                }

                // IDENTIFY VIOLATIONS
                return scope.filter(r => {
                    const sObj = utils.getTargets(r.source, covoModel.transforms);
                    const tObj = utils.getTargets(r.target, covoModel.transforms);
                    return !utils.isOverlapping(sObj, tObj) && !utils.hasRelationship(tObj, sObj, covoModel.isBasedOn);
                });
            },
            describe: 'Missing corresponding object relationship'
        },
        {
            id: 'C13',
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
            },
            describe: 'Missing corresponding relationship between stages or capabilities'
        },
        {
            id: 'V1',
            validate: function(covoModel, referenceCovoModel) {
                const violations = $();
                const maxLevel = utils.getMaxLevel(covoModel.elements);
                const lowestElements = covoModel.elements.filter(e => utils.getLevel(e) === maxLevel);
                const lowestRelationships = covoModel.horizontalRelationships.filter(r => utils.getLevel(r) === maxLevel);
                const configuredElementTypes = Object.entries(config.ELEMENT_TYPES).map(([_, v]) => v);
                configuredElementTypes.forEach(t1 => {
                    const elementsOfType = lowestElements.filter(t1);
                    if (elementsOfType.size() > 0) {
                        violations.add(referenceCovoModel.elements.filter(e => utils.getLevel(e) === maxLevel && e.type === t1).not(elementsOfType));
                    }
                    configuredElementTypes.forEach(t2 => {
                        const relationshipsOfType = lowestRelationships.filter(r => r.source.type === t1 && r.target.type === t2);
                        if (relationshipsOfType.size() > 0) {
                            violations.add(referenceCovoModel.horizontalRelationships.filter(r => utils.getLevel(r) === maxLevel && r.source.type === t1 && r.target.type === t2).not(relationshipsOfType));
                        }
                    })
                });

                return violations;
            },
            describe: 'Missing in this view'
        },
        {
            id: 'V2',
            validate: function(covoModel, referenceCovoModel) {
                return covoModel.elements.clone().add(covoModel.horizontalRelationships).not(referenceCovoModel.concepts);
            },
            describe: 'Not in any value stream view'
        }
    ];

})();
