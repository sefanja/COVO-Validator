var config = (function() {

    const VIOLATION_EXAMPLES = 5;

    const FLASH = {
        enabled: true,
        color: '#ff0000',
        speed: 250,
        count: 3
    };

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
    };

    function getHorizontalRelationKinds() {
        return Object.values(RELATIONS).filter(r => r.sourceType !== null || r.targetType !== null);
    }

    function getHorizontalReflexiveRelationKinds() {
        return Object.values(RELATIONS).filter(r => r.sourceType !== null && r.sourceType === r.targetType);
    }

    function getKind(concept) {
        if (concept.type.endsWith('-relationship')) {
            return Object.entries(RELATIONS).filter(([key, r]) =>
                concept.type === r.type && (
                    r.sourceType === null && concept.source.type === concept.target.type
                ) || (
                    concept.source.type === (!r.inverse ? r.sourceType : r.targetType)
                    && concept.target.type === (!r.inverse ? r.targetType : r.sourceType)
                )
            )[0][0];
        } else {
            return Object.entries(ELEMENTS).filter(([key, e]) => concept.type === e)[0][0];
        }
    }

    return {
        VIOLATION_EXAMPLES: VIOLATION_EXAMPLES,
        FLASH: FLASH,
        ELEMENTS: ELEMENTS,
        RELATIONS: RELATIONS,
        getHorizontalRelationKinds: getHorizontalRelationKinds,
        getHorizontalReflexiveRelationKinds: getHorizontalReflexiveRelationKinds,
        getKind: getKind
    };

})();
