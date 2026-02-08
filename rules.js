var rules = (function() {

    return [
        {
            id: 'C1',
            name: 'Unique parent',
            validate: function(context) {
                // DETERMINE SCOPE
                const scope = context.elements;

                // IDENTIFY VIOLATIONS
                const violations = scope.filter(utils.hasMultipleParents);

                return {id: this.id, violations: violations};
            }
        },
        {
            id: 'C2',
            name: 'Acyclicity',
            validate: function(context) {
                // DETERMINE SCOPE
                const scope = context.isRefinedBy;

                // IDENTIFY VIOLATIONS
                const violations = scope.filter(r => utils.canReach(r.target, r.source, context.isRefinedBy));

                return {id: this.id, violations: violations};
            }
        },
        {
            id: 'C3',
            name: 'Consistent refinement depth',
            validate: function(context) {
                // DETERMINE SCOPE
                const scope = context.elements.filter(utils.isLeaf);

                // IDENTIFY VIOLATIONS
                const dominantDepth = utils.getDominantDepth(scope);
                const violations = scope.filter(e => utils.getLevel(e) !== dominantDepth);

                return {id: this.id, violations: violations};
            }
        },
        {
            id: 'C4',
            name: 'Upward coherence',
            validate: function(context) {
                // DETERMINE SCOPE
                let scope = context.horizontalRelationships.filter(r =>
                    !(r.source.type === config.TYPES.object && r.target.type === config.TYPES.object) // exclude objects
                );

                if (context.partial) {
                    // Only same-type relationships with adjacent levels
                    scope = utils.filterByLevelAdjacency(scope, -1);

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

                return {id: this.id, violations: violations};
            }
        },
        {
            id: 'C5',
            name: 'Downward coherence',
            validate: function(context) {
                // DETERMINE SCOPE
                let scope = context.horizontalRelationships.clone();

                if (context.partial) scope = utils.filterByLevelAdjacency(scope, 1);

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

                return {id: this.id, violations: violations};
            }
        },
        {
            id: 'C6',
            name: 'Capability impact',
            validate: function(context) {
                // DETERMINE SCOPE
                let scope = context.capabilities.clone();

                if (context.partial) scope = utils.filterByLevel(scope, utils.getLevels(context.transforms));

                // IDENTIFY VIOLATIONS
                const violations = scope.filter(e => {
                    const objectCount = utils.getTargets(e, context.transforms).size();
                    return utils.isLeaf(e) ? (objectCount < 1) : (objectCount !== 1);
                });

                return {id: this.id, violations: violations};
            }
        },
        {
            id: 'C7',
            name: 'Object relevance',
            validate: function(context) {
                // DETERMINE SCOPE
                let scope = context.objects.clone();

                if (context.partial) scope = utils.filterByLevel(scope, utils.getLevels(context.transforms));

                // IDENTIFY VIOLATIONS
                const violations = scope.filter(e => {
                    const capabilityCount = utils.getSources(e, context.transforms).size();
                    return utils.isLeaf(e) ? (capabilityCount < 1) : (capabilityCount !== 1);
                });

                return {id: this.id, violations: violations};
            }
        },
        {
            id: 'C8',
            name: 'Capability purpose',
            validate: function(context) {
                // DETERMINE SCOPE
                let scope = context.capabilities.clone();

                if (context.partial) {
                    scope = utils.filterByLevel(scope, utils.getSharedLevels(context.enables, context.isManifestedBy));
                }

                // IDENTIFY VIOLATIONS
                const violations = scope.filter(e => !utils.canReach(e, config.TYPES.stream, context.enables.clone().add(context.isManifestedBy)));

                return {id: this.id, violations: violations};
            }
        },
        {
            id: 'C9',
            name: 'Traceability',
            validate: function(context) {
                // DETERMINE SCOPE
                let scope = context.streams.clone();

                if (context.partial) scope = utils.filterByLevel(scope, utils.getLevels(context.isManifestedBy));

                // IDENTIFY VIOLATIONS
                const violations = scope.filter(e => utils.getSources(e, context.isManifestedBy).size() !== 1);

                return {id: this.id, violations: violations};
            }
        },
        {
            id: 'C10',
            name: 'Exclusive manifestation',
            validate: function(context) {
                // DETERMINE SCOPE
                let scope = context.capabilities.clone();

                if (context.partial) scope = utils.filterByLevel(scope, utils.getLevels(context.isManifestedBy));

                // IDENTIFY VIOLATIONS
                const violations = scope.filter(e => {
                    const streams = utils.getTargets(e, context.isManifestedBy);
                    return !utils.isLeaf(e) && streams.size() > utils.getRoots(streams).size();
                });

                return {id: this.id, violations: violations};
            }
        },
        {
            id: 'C11',
            name: 'Capability-driven dependencies',
            validate: function(context) {
                // DETERMINE SCOPE
                let scope = context.enables.clone();

                if (context.partial) {
                    scope = utils.filterByLevel(scope, utils.getSharedLevels(context.transforms, context.isBasedOn));
                }

                // IDENTIFY VIOLATIONS
                const violations = scope.filter(r => {
                    const sObj = utils.getTargets(r.source, context.transforms);
                    const tObj = utils.getTargets(r.target, context.transforms);
                    return !utils.isOverlapping(sObj, tObj) && !utils.isRelated(tObj, sObj, context.isBasedOn);
                });

                return {id: this.id, violations: violations};
            }
        },
        {
            id: 'C12',
            name: 'Value stream-driven dependencies',
            validate: function(context) {
                // DETERMINE SCOPE
                let scope = context.precedes.clone();

                if (context.partial) {
                    scope = utils.filterByLevel(scope, utils.getSharedLevels(context.isManifestedBy, context.transforms));
                }

                // IDENTIFY VIOLATIONS
                const violations = scope.filter(r => {
                    const sObj = utils.getTargets(utils.getSources(r.source, context.isManifestedBy), context.transforms);
                    const tObj = utils.getTargets(utils.getSources(r.target, context.isManifestedBy), context.transforms);
                    return !utils.isOverlapping(sObj, tObj) && !utils.isRelated(tObj, sObj, context.isBasedOn);
                });

                return {id: this.id, violations: violations};
            }
        },
        {
            id: 'C13',
            name: 'Grounded dependencies',
            validate: function(context) {
                // DETERMINE SCOPE
                let scope = context.isBasedOn.clone();

                if (context.partial) {
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

                return {id: this.id, violations: violations};
            }
        },
    ];

})();
