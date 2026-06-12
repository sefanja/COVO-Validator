var config = (function() {

    function autoDetect(...types) {
        for (const t of types) if (selection.find(t).size() > 0) return t;
        return types.shift();
    }

    const ELEMENT_TYPES = {
        stream: autoDetect('value-stream', 'business-process'),
        capability: autoDetect('capability', 'business-function'),
        object: 'business-object'
    };

    const REL_TYPES = {
        isRefinedBy: 'composition-relationship',
        affects: 'flow-relationship',
        enablesWithCoManifestation: 'serving-relationship',
        enablesWithoutCoManifestation: 'flow-relationship',
        isBasedOn: 'association-relationship',
        isPrincipalOf: 'serving-relationship',
        canTransform: ELEMENT_TYPES.capability === 'business-function' ? 'access-relationship' : 'association-relationship'
    }

    // ASSUMED RELATIONSHIP DIRECTIONS:
    // isRefinedBy: from parent to child
    // affects: from predecessor to successor
    // enablesWithCoManifestation: from provider to consumer
    // enablesWithoutCoManifestation: from provider to consumer
    // isBasedOn: from depender to dependee
    // isPrincipalOf: from capability to value stream
    // canTransform: from capability to object

    const VIOLATION_EXAMPLES = 5;

    return {
        ELEMENT_TYPES: ELEMENT_TYPES,
        REL_TYPES: REL_TYPES,
        VIOLATION_EXAMPLES: VIOLATION_EXAMPLES
    };

})();
