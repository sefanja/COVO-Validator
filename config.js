var config = (function() {

    const VIOLATION_EXAMPLES = 5;

    // Metamodel definitions
    const ELEMENTS = {
        valueStream: 'business-process',
        capability: 'business-function',
        object: 'business-object'
    };

    const RELATIONS = {
        refinement: {
            type: 'composition-relationship',
            sourceType: null, // identical to targetType
            targetType: null, // identical to sourceType
            inverse: false // default: from parent to child
        },
        succession: {
            type: 'triggering-relationship',
            sourceType: ELEMENTS.valueStream,
            targetType: ELEMENTS.valueStream,
            inverse: false
        },
        support: {
            type: 'serving-relationship',
            sourceType: ELEMENTS.capability,
            targetType: ELEMENTS.capability,
            inverse: false
        },
        material: {
            type: 'association-relationship',
            sourceType: ELEMENTS.object,
            targetType: ELEMENTS.object,
            inverse: false
        },
        manifestation: {
            type: 'serving-relationship',
            sourceType: ELEMENTS.capability,
            targetType: ELEMENTS.valueStream,
            inverse: false
        },
        transformation: {
            type: 'access-relationship',
            sourceType: ELEMENTS.capability,
            targetType: ELEMENTS.object,
            inverse: false
        },
        getHorizontalRelations: function() {
            return [this.succession, this.support, this.material, this.manifestation, this.transformation];
        },
        getHorizontalReflexiveRelations: function() {
            return [this.material, this.succession, this.support];
        }
    };

    return {
        VIOLATION_EXAMPLES: VIOLATION_EXAMPLES,
        ELEMENTS: ELEMENTS,
        RELATIONS: RELATIONS
    };

})();
