var config = (function() {

    function autoDetect(...types) {
        for (const t of types) if (selection.find(t).size() > 0) return t;
        return types.shift();
    }

    const TYPES = {
        stream: autoDetect('value-stream', 'business-process'),
        capability: autoDetect('capability', 'business-function'),
        object: autoDetect('resource', 'business-object'),
        refinement: autoDetect('composition-relationship', 'aggregation-relationship') // The chosen relationship type may only be used for refinement
    };

    // ASSUMED RELATIONSHIP DIRECTIONS:
    // refinement: from parent to child (e.g., composition or aggregation)
    // precedence: from predecessor to successor (e.g., triggering or flow)
    // enablement: from provider to consumer (e.g., serving)
    // structural dependency: from depender to dependee (e.g., directed association)
    // manifestation: from capability to value stream (e.g., serving)
    // transformation: from capability to object (e.g., access or directed association)

    const VIOLATION_EXAMPLES = 5;

    return {
        TYPES: TYPES,
        VIOLATION_EXAMPLES: VIOLATION_EXAMPLES
    };

})();
