var config = (function() {

    const TYPES = {
        stream: 'business-process', // or 'value-stream'
        capability: 'business-function', // or 'capability'
        object: 'business-object', // or 'resource'
        refinement: 'composition-relationship' // The chosen relationship type may only be used for refinement
    };

    // ASSUMED RELATIONSHIP DIRECTIONS:
    // refinement: from parent to child (e.g., composition or aggregation)
    // precedence: from predecessor to successor (e.g., triggering or flow)
    // enablement: from provider to consumer (e.g., serving)
    // structural dependency: from depender to dependee (e.g., directed association)
    // manifestation: from capability to value stream (e.g., serving)
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
