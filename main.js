(function() {

    // Choose between options
    const OPTIONS = {
        full: 'FULL: validate full model against all rules',
        partial: 'PARTIAL: validate selection against applicable rules'
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
    if (!partial) {
        allElements = model.find('element');
        allRelationships = model.find('relationship');
    } else {
        // Important for developers to understand: The elements and relationships added to the context
        // are limited by the selection while their properties are not. For example, elements.rels()
        // returns all relationships, including those not present in the current selection.
        allElements = $();
        selection.find('element').map(e => e.concept).forEach(c => allElements.add(c));
        allRelationships = $();
        selection.find('relationship').map(r => r.concept).forEach(c => allRelationships.add(c));
    }
    const context = {
        partial: partial,
        elements: allElements,
        valueStreams: $(),
        capabilities: $(),
        objects: $(),
        relationships: allRelationships,
        refinementRelations: $(),
        successionRelations: $(),
        supportRelations: $(),
        materialRelations: $(),
        manifestationRelations: $(),
        transformationRelations: $(),
        horizontalRelations: $(),
        horizontalReflexiveRelations: $(),
    };

    allElements.each(e => {
        switch (e.type) {
            case config.TYPES.valueStream: context.valueStreams.add(e); break;
            case config.TYPES.capability: context.capabilities.add(e); break;
            case config.TYPES.object: context.objects.add(e); break;
        }
    });

    allRelationships.each(r => {
        if (r.type === config.TYPES.refinement) {
            context.refinementRelations.add(r);
        } else {
            context.horizontalRelations.add(r);

            const s = r.source.type;
            const t = r.target.type;
            if (s === t) {
                context.horizontalReflexiveRelations.add(r);
                switch (s) {
                    case config.TYPES.valueStream: context.successionRelations.add(r); break;
                    case config.TYPES.capability: context.supportRelations.add(r); break;
                    case config.TYPES.object: context.materialRelations.add(r); break;
                }
            } else if (s === config.TYPES.capability && t === config.TYPES.valueStream) {
                context.manifestationRelations.add(r);
            } else if (s === config.TYPES.capability && t === config.TYPES.object) {
                context.transformationRelations.add(r);
            }
        }
    });

    // Execution engine
    console.clear();
    console.log(`Starting COVO Validator to check ${context.elements.size()} elements and ${context.relationships.size()} relationships...`);

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
    console.show();
    console.log('======================================================================');
    console.log('                      VALIDATION REPORT');
    console.log('======================================================================');
    console.log();
    console.log('OVERALL STATUS: ' + (summary.totalViolations > 0 ? 'FAILED' : 'PASSED'));
    console.log();
    if (summary.totalViolations > 0) {
        console.log('VIOLATION SUMMARY:')
        console.log('  - Total Violations: ' + summary.totalViolations);
        console.log('  - Rules Passed: ' + summary.passed.join(', '));
        console.log('  - Rules Failed: ' + summary.failed.join(', '));
        console.log();
        console.log('NOTE: Fix C1 and C2 violations before proceeding to the other ones.');
        console.log();
        console.log('----------------------------------------------------------------------');
        console.log('                   DETAILED VIOLATION ANALYSIS');
        console.log('----------------------------------------------------------------------');
        results.forEach(res => {
            if (res.violationCount > 0) {
                console.log();
                console.log('[!!] ' + res.id + ' - ' + res.name + ': ' + res.violationCount + ' violations');
                console.log('----------------------------------------------------------------------');
                console.log('  * Statement: ' + res.statement);
                console.log('  * Examples of violating items:');
                let count = 0;
                res.violations.each(function(v) {
                    if(count < config.VIOLATION_EXAMPLES) {
                        if (utils.isRelationship(v)) {
                            console.log('    - ' + v.source.name + ' --> ' + v.target.name);
                        } else {
                            console.log('    - ' + (v.name ? v.name : v.type));
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
