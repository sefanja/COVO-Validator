(function() {

    const PARTIAL_SELECTION = true;

    // 1. Load dependencies
    load(__DIR__ + 'config.js');
    load(__DIR__ + 'rules.js');
    load(__DIR__ + 'utils.js');

    const activeRules = rules(config, utils);

    // 2. Prepare context (data preparation)
    let allElements, allRelationships;
    if (!PARTIAL_SELECTION) {
        allElements = model.find('element');
        allRelationships = model.find('relationship');
    } else {
        // TODO: selection vs. model
        // allElements = $();
        // selection.find('element').map(e => e.concept).forEach(c => allElements.add(c));
        // allRelaltionships = $();
        // selection.find('relationship').map(r => r.concept).forEach(c => allRelaltionships.add(c));
        allElements = selection.find('element')
        allRelationships = selection.find('relationship')
    }
    const context = {
        partialSelection: PARTIAL_SELECTION,
        elements: allElements,
        valueStreams: allElements.filter(config.ELEMENTS.valueStream),
        capabilities: allElements.filter(config.ELEMENTS.capability),
        objects: allElements.filter(config.ELEMENTS.object),
        relationships: allRelationships,
        refinementRelations: utils.filterRelationshipsByKind(allRelationships, config.RELATIONS.refinement),
        successionRelations: utils.filterRelationshipsByKind(allRelationships, config.RELATIONS.succession),
        supportRelations: utils.filterRelationshipsByKind(allRelationships, config.RELATIONS.support),
        materialRelations: utils.filterRelationshipsByKind(allRelationships, config.RELATIONS.material),
        manifestationRelations: utils.filterRelationshipsByKind(allRelationships, config.RELATIONS.manifestation),
        transformationRelations: utils.filterRelationshipsByKind(allRelationships, config.RELATIONS.transformation),
        horizontalRelations: utils.filterRelationshipsByKind(allRelationships, ...config.RELATIONS.getHorizontalRelations()),
        horizontalReflexiveRelations: utils.filterRelationshipsByKind(allRelationships, ...config.RELATIONS.getHorizontalReflexiveRelations())
    };

    console.clear();
    console.log(`Starting COVO Validator to check ${context.elements.size()} elements and ${context.relationships.size()} relationships...`);

    // 3. Execution engine
    const results = [];
    const summary = { passed: [], failed: [], totalViolations: 0 };

    activeRules.forEach(rule => {
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

    // 4. Report generation
    function printReport(results, summary) {
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
                    console.log('[!!] ' + res.id + ' - ' + res.name + ': ' + res.violationCount);
                    console.log('----------------------------------------------------------------------');
                    console.log('  * Statement: ' + res.statement);
                    console.log('  * Examples of violating items:');
                    let count = 0;
                    res.violations.each(function(v) {
                        if(count < config.VIOLATION_EXAMPLES) {
                            console.log('    - ' + (v.name ? v.name : v.type));
                            count++;
                        }
                    });
                    console.log('');
                    utils.flash(res.violations);
                }
            });
        }
    }

    printReport(results, summary);

})();
