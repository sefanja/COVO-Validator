var config = (function() {

    const TYPES = {
        valueStream: 'business-process', // or value-stream
        capability: 'business-function', // or capability
        object: 'business-object',
        refinement: 'composition-relationship' // or aggregation-relationship (IMPORTANT: the chosen relationship type may only be used for refinement)
    };

    // ASSUMED RELATIONSHIP DIRECTIONS:
    // refinement: from parent to child (e.g., composition or aggregation)
    // succession: from predecessor to successor (e.g., triggering or flow)
    // support: from provider to consumer (e.g., serving)
    // material: from depender to dependee (e.g., directed association)
    // manifestation: from capability to value stream (e.g., serving or aggregation)
    // transformation: from capability to object (e.g., access or directed association)

    const VIOLATION_EXAMPLES = 5;

    const FLASH = {
        enabled: true,
        color: '#ff0000',
        speed: 250,
        count: 3
    };

    return {
        TYPES: TYPES,
        VIOLATION_EXAMPLES: VIOLATION_EXAMPLES,
        FLASH: FLASH
    };

})();
