const VIOLATION_EXAMPLES = 5;

// Metamodel definitions
const TYPES = {
    capability: 'business-function',
    object: 'business-object',
    valueStream: 'business-process'
};

const RELATIONS = {
    manifestation: {
        type: 'serving-relationship',
        sourceType: TYPES.capability,
        targetType: TYPES.valueStream,
        inverse: false
    },
    material: {
        type: 'association-relationship',
        sourceType: TYPES.object,
        targetType: TYPES.object,
        inverse: false
    },
    refinement: {
        type: 'composition-relationship',
        sourceType: null, // identical to targetType
        targetType: null, // identical to sourceType
        inverse: false // default: from parent to child
    },
    succession: {
        type: 'triggering-relationship',
        sourceType: TYPES.valueStream,
        targetType: TYPES.valueStream,
        inverse: false
    },
    support: {
        type: 'serving-relationship',
        sourceType: TYPES.capability,
        targetType: TYPES.capability,
        inverse: false
    },
    transformation: {
        type: 'access-relationship',
        sourceType: TYPES.capability,
        targetType: TYPES.object,
        inverse: false
    },
    getHorizontalReflexiveRelations: function() {
        return [this.material, this.succession, this.support];
    }
};

const PROPERTIES = {
    level: 'Level' // Property name in Archi
};
