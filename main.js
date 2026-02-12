(function() {
    const _EMPTY = $(); // cloning this collection is significanlty faster than creating a new one with $()

    const views = selection.find('archimate-diagram-model').add(selection.filter('archimate-diagram-model'));
    if (views.size() === 0) {
        window.alert("There are no views in the current selection.");
        return;
    }

    // Validation profile
    const PROFILE = {
        construction: 'CONSTRUCTION: progressive validation (silent)',
        audit: 'AUDIT: strict validation (full report)'
    };
    const choice = '' + window.promptSelection("Validation profile", Object.values(PROFILE));
    if (!Object.values(PROFILE).includes(choice)) return; // user chose to cancel
    const strict = choice === PROFILE.audit;

    // Initialize
    console.clear();
    console.show();
    const start = Date.now();
    load(__DIR__ + 'config.js');
    load(__DIR__ + 'rules.js');
    load(__DIR__ + 'utils.js');

    // Collect views for validation
    const landscapeViews = _EMPTY.clone();
    const objectDomainViews = _EMPTY.clone();
    const valueStreamViews = _EMPTY.clone();
    const valueStreamViewCollections = {};

    views.each(view => {
        const viewContext = utils.buildContext($(view).find());
        const topStream = utils.getTopValueStream(viewContext);

        if (topStream) { // value stream view
            const id = topStream.id;
            if (!valueStreamViewCollections[id]) valueStreamViewCollections[id] = _EMPTY.clone();
            valueStreamViewCollections[id].add(view);
            valueStreamViews.add(view);
        } else if (strict) {
            if (utils.identifyDomainHeader(viewContext)) {
                objectDomainViews.add(view);
            } else {
                landscapeViews.add(view);
            }
        }
    });

    const valueStageZones = utils.getValueStageZones(valueStreamViews);

    // Validate
    const globalContext = utils.buildContext(selection.find());
    const valueStreamContext = utils.buildContext(valueStreamViews.find());

    const globalViolations = [];
    const valueStreamCollectionViolations = [];
    const valueStageZoneViolations = [];
    const objectDomainViewViolations = [];
    const landscapeViewViolations = [];

    const summary = { failed: new Set(), totalViolations: 0 };

    for (const rule of rules.filter(r => ['C1', 'C2', 'C3'].includes(r.id))) {
        const violations = rule.validate(globalContext, strict);
        const violationCount = violations.size();
        if (violationCount > 0) {
            globalViolations.push({
                id: rule.id,
                name: rule.name,
                violations: violations,
                violationCount: violationCount
            });
            summary.totalViolations += violationCount;
            summary.failed.add(rule.id);
        }
    }

    for (const [topStreamId, views] of Object.entries(valueStreamViewCollections)) {
        const context = utils.buildContext(views.find());
        for (const rule of rules.filter(r => ['C4', 'C5', 'C6', 'C7', 'C8', 'C9', 'C10', 'C11', 'C12', 'C13'].includes(r.id))) {
            const violations = rule.validate(context, strict);
            const violationCount = violations.size();
            if (violationCount > 0) {
                valueStreamCollectionViolations.push({
                    id: rule.id,
                    name: rule.name,
                    violations: violations,
                    violationCount: violationCount,
                    streamName: $('#' + topStreamId).first().name
                });
                summary.totalViolations += violationCount;
                summary.failed.add(rule.id);
            }
        }
    }

    if (valueStreamCollectionViolations.length === 0) {
        for (const stage of valueStageZones) {
            for (const rule of rules.filter(r => ['C12', 'C13'].includes(r.id))) {
                const violations = rule.validate(stage.context, true);
                const violationCount = violations.size();
                if (violationCount > 0) {
                    valueStageZoneViolations.push({
                        id: rule.id,
                        name: rule.name,
                        violations: violations,
                        violationCount: violationCount,
                        viewName: stage.viewName,
                        stageName: stage.name
                    });
                    summary.totalViolations += violationCount;
                    summary.failed.add(rule.id);
                }
            }
        }
    }

    for (const view of objectDomainViews) {
        for (const rule of rules.filter(r => ['V1', 'V2'].includes(r.id))) {
            const viewContext = utils.buildContext($(view).find());
            const domain = utils.identifyDomainHeader(viewContext);
            const domainLevel = utils.getLevel(domain);
            const lowestLevel = Math.max(...utils.getLevels(viewContext.objects));
            let domainObjects = $(domain);
            for (let i = 0; i < lowestLevel - domainLevel; i++) {
                domainObjects = utils.getChildren(domainObjects);
            }
            const domainIsBasedOnIds = domainObjects.rels().filter(r => r.type !== config.TYPES.refinement && r.source.type === config.TYPES.object && r.target.type === config.TYPES.object).map(r => r.id);
            const valueStreamIsBasedOn = valueStreamContext.isBasedOn.filter(r => domainIsBasedOnIds.includes(r.id));
            const referenceContext = utils.buildContext(valueStreamIsBasedOn.add(valueStreamIsBasedOn.ends()));
            const violations = rule.validate(viewContext, referenceContext);
            const violationCount = violations.size();
            if (violationCount > 0) {
                objectDomainViewViolations.push({
                    id: rule.id,
                    name: rule.name,
                    violations: violations,
                    violationCount: violationCount,
                    viewName: view.name
                });
                summary.totalViolations += violationCount;
                summary.failed.add(rule.id);
            }
        }
    }

    for (const view of landscapeViews) {
        for (const rule of rules.filter(r => ['V1', 'V2'].includes(r.id))) {
            const violations = rule.validate(utils.buildContext($(view).find()), valueStreamContext);
            const violationCount = violations.size();
            if (violationCount > 0) {
                landscapeViewViolations.push({
                    id: rule.id,
                    name: rule.name,
                    violations: violations,
                    violationCount: violationCount,
                    viewName: view.name
                });
                summary.totalViolations += violationCount;
                summary.failed.add(rule.id);
            }
        }
    }

    // Report generation
    console.log(`Starting COVO Validator to check ${globalContext.elements.size()} elements and ${globalContext.relationships.size()} relationships...`);
    console.log();
    console.log('======================================================================');
    console.log('                       MODEL VALIDATION REPORT');
    console.log('======================================================================');
    console.log();
    console.log(`OVERALL STATUS: ${(summary.totalViolations > 0 ? 'FAILED' : 'PASSED')}`);

    if (summary.totalViolations > 0) {
        console.log();
        console.log('VIOLATION SUMMARY:');
        console.log(`  - Total Violations: ${summary.totalViolations}`);
        console.log(`  - Rules Failed: ${[...summary.failed].join(', ')}`);
        console.log();
        console.log('Recommended fix order: C1-3, V1-2, C6-13, C4-5');
    }

    if (globalViolations.length > 0) {
        console.log();
        console.log('----------------------------------------------------------------------');
        console.log('                          GLOBAL VIOLATIONS');
        console.log('----------------------------------------------------------------------');
        for (const violation of globalViolations) {
            console.log();
            console.log(`[!!] ${violation.id} - ${violation.name}`);
            console.log('----------------------------------------------------------------------');
            console.log(`${violation.violationCount} violations:`);
            let count = 0;
            violation.violations.each(v => {
                if(count < config.VIOLATION_EXAMPLES) {
                    if (utils.isRelationship(v)) console.log(`- ${v.source.name} (L${utils.getLevel(v.source)} ${v.source.type}) --> ${v.target.name} (L${utils.getLevel(v.target)} ${v.target.type})`);
                    else console.log(`- ${v.name} (L${utils.getLevel(v)} ${v.type})`);
                    count++;
                }
            });
            console.log();
        }
    }

    if (valueStreamCollectionViolations.length > 0) {
        console.log();
        console.log('----------------------------------------------------------------------');
        console.log('                     VIOLATIONS IN VALUE STREAMS');
        console.log('----------------------------------------------------------------------');
        for (const violation of valueStreamCollectionViolations) {
            console.log();
            console.log(`[!!] ${violation.id} - ${violation.name}`);
            console.log('----------------------------------------------------------------------');
            console.log(`${violation.violations.size()} violations in ${violation.streamName}:`);
            let count = 0;
            violation.violations.each(v => {
                if(count < config.VIOLATION_EXAMPLES) {
                    if (utils.isRelationship(v)) console.log(`- ${v.source.name} (L${utils.getLevel(v.source)} ${v.source.type}) --> ${v.target.name} (L${utils.getLevel(v.target)} ${v.target.type})`);
                    else console.log(`- ${v.name} (L${utils.getLevel(v)} ${v.type})`);
                    count++;
                }
            });
            console.log();
        }
    }

    if (valueStageZoneViolations.length > 0) {
        console.log();
        console.log('----------------------------------------------------------------------');
        console.log('                      VIOLATIONS IN VALUE STAGES');
        console.log('----------------------------------------------------------------------');
        for (const violation of valueStageZoneViolations) {
            console.log();
            console.log(`[!!] ${violation.id} - ${violation.name}`);
            console.log('----------------------------------------------------------------------');
            console.log(`${violation.violations.size()} violations in ${violation.stageName} (${violation.viewName}):`);
            let count = 0;
            violation.violations.each(v => {
                if(count < config.VIOLATION_EXAMPLES) {
                    if (utils.isRelationship(v)) console.log(`- ${v.source.name} (L${utils.getLevel(v.source)} ${v.source.type}) --> ${v.target.name} (L${utils.getLevel(v.target)} ${v.target.type})`);
                    else console.log(`- ${v.name} (L${utils.getLevel(v)} ${v.type})`);
                    count++;
                }
            });
            console.log();
        }
    }

    if (objectDomainViewViolations.length > 0) {
        console.log();
        console.log('----------------------------------------------------------------------');
        console.log('                  VIOLATIONS IN OBJECT DOMAIN VIEWS');
        console.log('----------------------------------------------------------------------');
        for (const violation of objectDomainViewViolations) {
            console.log();
            console.log(`[!!] ${violation.id} - ${violation.name}`);
            console.log('----------------------------------------------------------------------');
            console.log(`${violation.violations.size()} violations in ${violation.viewName}:`);
            let count = 0;
            violation.violations.each(v => {
                if(count < config.VIOLATION_EXAMPLES) {
                    if (utils.isRelationship(v)) console.log(`- ${v.source.name} (L${utils.getLevel(v.source)} ${v.source.type}) --> ${v.target.name} (L${utils.getLevel(v.target)} ${v.target.type})`);
                    else console.log(`- ${v.name} (L${utils.getLevel(v)} ${v.type})`);
                    count++;
                }
            });
            console.log();
        }
    }

    if (landscapeViewViolations.length > 0) {
        console.log();
        console.log('----------------------------------------------------------------------');
        console.log('                    VIOLATIONS IN LANDSCAPE VIEWS');
        console.log('----------------------------------------------------------------------');
        for (const violation of landscapeViewViolations) {
            console.log();
            console.log(`[!!] ${violation.id} - ${violation.name}`);
            console.log('----------------------------------------------------------------------');
            console.log(`${violation.violations.size()} violations of ${violation.viewName}:`);
            let count = 0;
            violation.violations.each(function(v) {
                if(count < config.VIOLATION_EXAMPLES) {
                    if (utils.isRelationship(v)) console.log(`- ${v.source.name} (L${utils.getLevel(v.source)} ${v.source.type}) --> ${v.target.name} (L${utils.getLevel(v.target)} ${v.target.type})`);
                    else console.log(`- ${v.name} (L${utils.getLevel(v)} ${v.type})`);
                    count++;
                }
            });
            console.log();
        }
    }

    console.log();
    console.log(`Validation completed after ${Date.now() - start} ms`);

})();
