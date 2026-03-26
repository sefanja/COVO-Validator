var config = (function() {

    function autoDetect(...types) {
        for (const t of types) if (selection.find(t).size() > 0) return t;
        return types.shift();
    }

    const ELEMENT_TYPES = {
        stream: autoDetect('value-stream', 'business-process'),
        capability: autoDetect('capability', 'business-function'),
        object: autoDetect('resource', 'business-object')
    };

    const REL_TYPES = {
        isRefinedBy: autoDetect('composition-relationship', 'aggregation-relationship'), // The chosen relationship type may only be used for refinement
        coManifestsFor: 'serving-relationship'
    }

    // ASSUMED RELATIONSHIP DIRECTIONS:
    // refinement: from parent to child (e.g., composition or aggregation)
    // affects: from predecessor to successor (e.g., flow)
    // enables: from provider to consumer (e.g., flow)
    // coManifestsFor: from provider to consumer (e.g., triggering)
    // isBasedOn: from depender to dependee (e.g., directed association)
    // principal: from capability to value stream (e.g., serving)
    // transforms: from capability to object (e.g., access or directed association)

    const VIOLATION_EXAMPLES = 5;

    return {
        ELEMENT_TYPES: ELEMENT_TYPES,
        REL_TYPES: REL_TYPES,
        VIOLATION_EXAMPLES: VIOLATION_EXAMPLES
    };

})();
