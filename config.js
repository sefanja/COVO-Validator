const VIOLATION_EXAMPLES = 5;

// Metamodel definitions
const TYPES = {
    capability: 'capability',
    object: 'business-object',
    valueStream: 'value-stream'
};

const RELATIONS = {
    refinement: {
        type: 'composition-relationship',
        sourceType: null, // identical to targetType
        targetType: null, // identical to sourceType
        inverse: false // default: from parent to child
    },
    transformation: {
        type: 'association-relationship',
        sourceType: TYPES.capability,
        targetType: TYPES.object,
        inverse: false
    },
    support: {
        type: 'serving-relationship',
        sourceType: TYPES.capability,
        targetType: TYPES.capability,
        inverse: false
    },
    manifestation: {
        type: 'serving-relationship',
        sourceType: TYPES.capability,
        targetType: TYPES.valueStream,
        inverse: false
    }
};

const PROPERTIES = {
    level: 'Level' // Property name in Archi
};
