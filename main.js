(function() {

    // FULL or PARTIAL validation
    const OPTIONS = {
        partial: 'PARTIAL: validate selection against applicable rules',
        full: 'FULL: validate full model against all rules'
    };
    const choice = '' + window.promptSelection("Validate entire model or only the selected parts?", Object.values(OPTIONS));
    if (!Object.values(OPTIONS).includes(choice)) return; // user chose to cancel
    const partial = choice === OPTIONS.partial;

    // Load dependencies
    load(__DIR__ + 'config.js');
    load(__DIR__ + 'rules.js');
    load(__DIR__ + 'utils.js');

    // Prepare context (data preparation)
    let allElements, allRelationships;
    const allTypes = Object.entries(config.TYPES).map(([_, v]) => v);
    if (!partial) {
        allElements = model.find('element')
            .filter(e => allTypes.includes(e.type));
        allRelationships = model.find('relationship')
            .filter(r => allTypes.includes(r.source.type) && allTypes.includes(r.target.type));
    } else {
        // Important for developers to understand: We limit the elements and relationships to the
        // current selection but not their properties. Consequently, elements.rels() returns all
        // relationships on the selected elements, including the relationships that not part of
        // the current selection. This allows us to always know the element's place in the hierarchy.
        allElements = $();
        selection.find('element')
            .filter(e => allTypes.includes(e.type))
            .map(e => e.concept).forEach(c => allElements.add(c));
        allRelationships = $();
        selection.find('relationship')
            .filter(r => allTypes.includes(r.source.type) && allTypes.includes(r.target.type))
            .map(r => r.concept).forEach(c => allRelationships.add(c));
    }
    const context = {
        partial: partial,
        elements: allElements,
        streams: $(),
        capabilities: $(),
        objects: $(),
        relationships: allRelationships,
        isRefinedBy: $(), // vertical relationships
        horizontalRelationships: $(),
        precedes: $(), // stream to stream
        enables: $(), // capability to capability
        isBasedOn: $(), // object to object
        isManifestedBy: $(), // capability to stream
        transforms: $() // capability to object
    };

    allElements.each(e => {
        switch (e.type) {
            case config.TYPES.stream: context.streams.add(e); break;
            case config.TYPES.capability: context.capabilities.add(e); break;
            case config.TYPES.object: context.objects.add(e); break;
        }
    });

    allRelationships.each(r => {
        if (r.type === config.TYPES.refinement) {
            context.isRefinedBy.add(r);
        } else {
            context.horizontalRelationships.add(r);

            const s = r.source.type;
            const t = r.target.type;
            if (s === t) {
                switch (s) {
                    case config.TYPES.stream: context.precedes.add(r); break;
                    case config.TYPES.capability: context.enables.add(r); break;
                    case config.TYPES.object: context.isBasedOn.add(r); break;
                }
            } else if (s === config.TYPES.capability && t === config.TYPES.stream) {
                context.isManifestedBy.add(r);
            } else if (s === config.TYPES.capability && t === config.TYPES.object) {
                context.transforms.add(r);
            }
        }
    });

    // Execution engine
    const results = [];
    const summary = { passed: [], failed: [], totalViolations: 0 };

    rules.forEach(rule => {
        // Validate
        const result = rule.validate(context);
        
        // Add metadata to result
        result.name = rule.name;
        result.statement = rule.statement;
        result.violationCount = result.violations.size();
        
        results.push(result);

        // Update summary
        summary.totalViolations += result.violationCount;
        if (result.violationCount === 0) {
            summary.passed.push(rule.id);
        } else {
            summary.failed.push(rule.id);
        }
    });

    // Report generation
    console.clear();
    console.show();
    console.log(`Starting COVO Validator to check ${context.elements.size()} elements and ${context.relationships.size()} relationships...`);
    console.log();
    console.log('======================================================================');
    console.log('                      VALIDATION REPORT');
    console.log('======================================================================');
    console.log();
    console.log(`OVERALL STATUS: ${(summary.totalViolations > 0 ? 'FAILED' : 'PASSED')}`);
    console.log();
    if (summary.totalViolations > 0) {
        console.log('VIOLATION SUMMARY:');
        console.log(`  - Total Violations: ${summary.totalViolations}`);
        console.log(`  - Rules Failed: ${summary.failed.join(', ')}`);
        console.log();
        console.log('Recommended fix order: C1-3, C6-13, C4-5');
        console.log();
        console.log('----------------------------------------------------------------------');
        console.log('                   DETAILED VIOLATION ANALYSIS');
        console.log('----------------------------------------------------------------------');
        results.forEach(res => {
            if (res.violationCount > 0) {
                console.log();
                console.log(`[!!] ${res.id} - ${res.name}`);
                console.log('----------------------------------------------------------------------');
                console.log(`${res.violationCount} violations:`);
                let count = 0;
                res.violations.each(function(v) {
                    if(count < config.VIOLATION_EXAMPLES) {
                        if (utils.isRelationship(v)) {
                            console.log(`- ${v.source.name} --> ${v.target.name}`);
                        } else {
                            console.log(`- ${(v.name ? v.name : v.type)}`);
                        }
                        count++;
                    }
                });
                console.log('');
                utils.flash(res.violations);
            }
        });
    }

})();

