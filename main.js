(function() {
    const _EMPTY = $(); 

    const views = selection.find('archimate-diagram-model').add(selection.filter('archimate-diagram-model'));
    if (views.size() === 0) {
        window.alert('There are no views in the current selection.');
        return;
    }

    const PROFILE = {
        construction: '1. CONSTRUCTION: Validate work-in-progress (permissible)',
        audit: '2. AUDIT: Final cross-view check (requires all relevant views)'
    };
    const choice = '' + window.promptSelection("Validation profile", Object.values(PROFILE));
    if (!Object.values(PROFILE).includes(choice)) return; 
    const strict = choice === PROFILE.audit;

    const start = Date.now();

    load(`${__DIR__}config.js`);
    load(`${__DIR__}constraints.js`);
    load(`${__DIR__}utils.js`);

    // --- DATA STRUCTURES FOR VIEW-CENTRIC REPORTING ---
    const globalFailures = []; // C1, C2, C3 (Structural/Global)
    const viewReports = new Map(); // Key: view, Value: { failures: [] }

    function addFailureToView(view, constraint, result) {
        if (!viewReports.has(view.id)) {
            const path = utils.getViewPath(view);
            viewReports.set(view.id, {
                view: view,
                path: path, 
                viewFullName: `${path} / ${view.name}`,
                failures: []
            });
        }
        
        const report = viewReports.get(view.id);
        let existingFailure = report.failures.find(f => f.constraint.id === constraint.id);
        
        if (existingFailure) {
            existingFailure.violations.add(result.violations);
            existingFailure.violationCount = existingFailure.violations.size();
        } else {
            report.failures.push({
                constraint: constraint,
                violations: result.violations,
                violationCount: result.violations.size(),
                context: result.context
            });
        }
    }

    // --- CLASSIFY VIEWS ---
    const topLevelViews = _EMPTY.clone();
    const landscapeViews = _EMPTY.clone();
    const objectDomainViews = _EMPTY.clone();
    const valueStreamViews = _EMPTY.clone();
    const valueStreamViewCollections = {};

    views.each(view => {
        const covoModel = utils.buildCovoModel($(view).find());
        const topStream = utils.getTopValueStream(covoModel);
        const levels = utils.getLevels(covoModel.elements);

        if (levels.size === 1 && [...levels][0] === 0) {
            topLevelViews.add(view);
        } else if (topStream) {
            const id = topStream.id;
            if (!valueStreamViewCollections[id]) valueStreamViewCollections[id] = _EMPTY.clone();
            valueStreamViewCollections[id].add(view);
            valueStreamViews.add(view);
        } else if (utils.identifyDomainHeader(covoModel)) {
            objectDomainViews.add(view);
        } else {
            landscapeViews.add(view);
        }
    });

    const valueStageZones = utils.getValueStageZones(valueStreamViews);
    const globalCovoModel = utils.buildCovoModel(views.find());
    const valueStreamsCovoModel = utils.buildCovoModel(valueStreamViews.find().add(topLevelViews.find()));

    const summary = { failed: new Set(), totalViolations: 0 };

    // --- 1. GLOBAL CONSTRAINTS (C1, C2, C3) ---
    for (const constraint of constraints.filter(r => ['C1', 'C2', 'C3'].includes(r.id))) {
        const result = constraint.validate(globalCovoModel);
        if (result.violations.size() > 0) {
            globalFailures.push({
                constraint: constraint,
                violations: result.violations,
                violationCount: result.violations.size(),
                context: result.context
            });
            summary.totalViolations += result.violations.size();
            summary.failed.add(constraint.id);
        }
    }

    // --- 2. VIEW-SPECIFIC CONSTRAINTS ---

    // Top Level Views
    for (const view of topLevelViews) {
        const covoModel = utils.buildCovoModel($(view).find());
        for (const constraint of constraints.filter(r => ['C6', 'C7', 'C8', 'C9', 'C10', 'C11', 'C12', 'C13'].includes(r.id))) {
            const result = constraint.validate(covoModel, true);
            if (result.violations.size() > 0) {
                addFailureToView(view, constraint, result);
                summary.totalViolations += result.violations.size();
                summary.failed.add(constraint.id);
            }
        }
    }

    // Value Stream Collections (C4, C5, C9 etc)
    for (const [topStreamId, collectionViews] of Object.entries(valueStreamViewCollections)) {
        const covoModel = utils.buildCovoModel(collectionViews.find());
        const covoModelExtended = utils.buildCovoModel((topLevelViews.clone().add(collectionViews)).find());
        
        for (const constraint of constraints.filter(r => ['C4', 'C5', 'C6', 'C7', 'C8', 'C9', 'C10', 'C11', 'C12', 'C13'].includes(r.id))) {
            const result = constraint.validate(['C4', 'C9'].includes(constraint.id) ? covoModelExtended : covoModel, strict);
            
            if (result.violations.size() > 0) {
                summary.totalViolations += result.violations.size();
                summary.failed.add(constraint.id);

                // STAP 1: Pre-calculate de granulariteit per view in deze collectie
                const viewLevelMap = new Map();
                collectionViews.each(v => {
                    viewLevelMap.set(v.id, utils.getLowestLevel($(v).find()));
                });

                // STAP 2: Ken elke violation toe aan de juiste view
                result.violations.each(viol => {
                    const conceptLevel = utils.getLevel(viol);
                    const candidateViews = utils.getIntersection($(viol).viewRefs(), collectionViews);
                    if (candidateViews.size() > 0) {
                        const appropriateViews = candidateViews.filter(v => viewLevelMap.get(v.id) <= conceptLevel);
                        const selectionSet = appropriateViews.size() > 0 ? appropriateViews : candidateViews;

                        // Kies de meest granulaire view uit de selectie
                        let bestView = selectionSet.first();
                        let maxLevel = -1;
                        selectionSet.each(v => {
                            const currentLevel = viewLevelMap.get(v.id);
                            if (currentLevel > maxLevel) {
                                maxLevel = currentLevel;
                                bestView = v;
                            }
                        });

                        addFailureToView(bestView, constraint, { 
                            violations: $(viol),
                            context: result.context
                        });
                    }
                });
            } else if (['C12', 'C13'].includes(constraint.id)) {
                // Value Stream Stages
                for (const stage of valueStageZones.filter(z => z.topStreamId === topStreamId)) {
                    const result = constraint.validate(stage.covoModel, strict);
                    if (result.violations.size() > 0) {
                        addFailureToView(stage.view, constraint, { 
                            violations: result.violations,
                            context: result.context
                        });
                        summary.totalViolations += result.violations.size();
                        summary.failed.add(constraint.id);
                    }
                }
            }
        }
    }

    // Domain Views
    for (const domainView of objectDomainViews) {
        const covoModel = utils.buildCovoModel($(domainView).find());

        // Construct reference context
        const domainHeader = utils.identifyDomainHeader(covoModel);
        const headerLevel = utils.getLevel(domainHeader);
        const lowestLevel = Math.max(...utils.getLevels(covoModel.objects));
        let domainObjects = $(domainHeader);
        for (let i = 0; i < lowestLevel - headerLevel; i++) {
            domainObjects = utils.getChildren(domainObjects);
        }
        const domainIsBasedOn = domainObjects.rels().filter(r => r.type !== config.REL_TYPES.isRefinedBy && r.source.type === config.ELEMENT_TYPES.object && r.target.type === config.ELEMENT_TYPES.object); // all rels in the entire model between and with domain objects
        const collectionIsBasedOn = utils.getIntersection(valueStreamsCovoModel.isBasedOn, domainIsBasedOn); // rels scoped back to value stream and top-level views (what you select is what you get)
        const referenceContext = utils.buildCovoModel($(domainHeader).add(collectionIsBasedOn).add(collectionIsBasedOn.ends()));

        for (const constraint of constraints.filter(r => ['V1', 'V2'].includes(r.id))) {
            const result = constraint.validate(covoModel, referenceContext);
            if (result.violations.size() > 0) {
                addFailureToView(domainView, constraint, result);
                summary.totalViolations += result.violations.size();
                summary.failed.add(constraint.id);
            }
        }
    }

    // Landscape Views
    for (const landscapeView of landscapeViews) {
        const covoModel = utils.buildCovoModel($(landscapeView).find());
        for (const constraint of constraints.filter(r => ['V1', 'V2'].includes(r.id))) {
            const result = constraint.validate(covoModel, valueStreamsCovoModel);
            if (result.violations.size() > 0) {
                addFailureToView(landscapeView, constraint, result);
                summary.totalViolations += result.violations.size();
                summary.failed.add(constraint.id);
            }
        }
    }

    // --- REPORT GENERATION ---
    console.clear();
    console.show();
    console.log(`COVO Validator Report - ${strict ? 'AUDIT' : 'CONSTRUCTION'}`);
    console.log(`Status: ${(summary.totalViolations > 0 ? 'FAILED' : 'PASSED')}`);
    
    console.log(`Violations: ${summary.totalViolations}`);
    console.log(`Constraints failed: ${[...summary.failed].join(', ')}`);
    console.log();

    // 1. Rapporteer Globalen
    console.log('======================================================================');
    console.log('                      GLOBAL STRUCTURAL INTEGRITY');
    console.log('======================================================================');
    renderFailures(globalFailures);

    // 3. Rapporteer per View (gesorteerd)
    Array.from(viewReports).sort((a, b) => a[1].viewFullName.localeCompare(b[1].viewFullName)).forEach(([_, vReport]) => {
        console.log();
        console.log('======================================================================');
        console.log(` VIEW: ${vReport.view.name.toUpperCase()}`);
        console.log(` Path: ${vReport.path}`);
        console.log('======================================================================');
        renderFailures(vReport.failures);
    });

    /**
     * Rendert de lijst met failures.
     */
    function renderFailures(failures) {
        for (const f of failures) {
            console.log(` [!!] ${f.constraint.id} - ${f.constraint.name}`);
            
            let count = 0;
            f.violations.each(v => {
                if (count < config.VIOLATION_EXAMPLES) {
                    if (count === 0) console.log(`      ${f.constraint.describe(v, f.context)}`);
                    else console.log(`      - ${utils.formatConcept(v)}`);
                    count++;
                }
            });
            if (f.violationCount > config.VIOLATION_EXAMPLES) {
                console.log(`      - ... and ${f.violationCount - config.VIOLATION_EXAMPLES} more`);
            }
            console.log();
        }
    }

    console.log(`Validation completed in ${Date.now() - start} ms`);
})();
