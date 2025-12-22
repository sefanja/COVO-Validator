const PARTIAL_SELECTION = true;

// 1. Load dependencies
load(__DIR__ + 'config.js');
load(__DIR__ + 'rules.js');
load(__DIR__ + 'utils.js');

// 2. Prepare context (data preparation)
const collection = PARTIAL_SELECTION ? selection : model;
const context = {
    partialSelection: PARTIAL_SELECTION,
    elements: collection.find('element'),
    objects: collection.find(TYPES.object),
    capabilities: collection.find(TYPES.capability),
    valueStreams: collection.find(TYPES.valueStream),
    relationships: collection.find('relationship'),
};
for (const [key, value] of Object.entries(RELATIONS)) {
    context[key] = utils.filterRelation(collection.find('relationship'), value);
}


console.clear();
console.log(`Starting COVO Validator to check ${context.elements.size()} elements and ${context.relationships.size()} relationships...`);

// 3. Execution engine
const results = [];
const summary = { passed: [], failed: [], totalViolations: 0 };

Rules.forEach(rule => {
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
    console.log('OVERALL STATUS: ' + (summary.totalViolations > 0 ? 'FAILED' : 'PASSED'));
    console.log('Total Violations: ' + summary.totalViolations);
    console.log('Rules Failed: ' + summary.failed.join(', '));
    console.log('');

    if (summary.totalViolations > 0) {
        console.log('--- DETAILS ---');
        results.forEach(res => {
            if (res.violationCount > 0) {
                console.log('[FAIL] ' + res.id + ': ' + res.name);
                console.log('       ' + res.violationCount + ' violations.');
                console.log('       Statement: ' + res.statement);
                
                // Print examples
                var count = 0;
                res.violations.each(function(v) {
                    if(count < VIOLATION_EXAMPLES) {
                        console.log('       - ' + (v.name ? v.name : v.type));
                        count++;
                    }
                });
                console.log('');
            }
        });
    }
}

printReport(results, summary);
