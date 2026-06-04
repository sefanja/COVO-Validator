(function() {
    const _EMPTY = $(); // cloning this collection is significanlty faster than creating a new one with $()

    // Validation scope
    const views = selection.find('archimate-diagram-model').add(selection.filter('archimate-diagram-model'));
    if (views.size() === 0) {
        window.alert('There are no views in the current selection.');
        return;
    }

    // Valdation mode
    const PROFILE = {
        construction: '1. CONSTRUCTION: Validate work-in-progress (permissible)',
        audit: '2. AUDIT: Final cross-view check (requires all relevant views)'
    };
    const choice = '' + window.promptSelection("Validation profile", Object.values(PROFILE));
    if (!Object.values(PROFILE).includes(choice)) return; 
    const strict = choice === PROFILE.audit;

    // Validation time
    const start = Date.now();

    // Includes
    load(`${__DIR__}config.js`);
    load(`${__DIR__}constraints.js`);
    load(`${__DIR__}utils.js`);

    // --- DATA STRUCTURES FOR REPORTING ---
    const modelFailures = [];
    const viewFailures = new Map(); // Key: view.id, Value: { view, path, failures }
    const violationCounts = new Map(); // Key: constraint.id, Value: Number

    /**
     * Remembers failures for reporting.
     */
    function rememberFailures(view, constraint, violations) {
        if (violations.size() === 0) return;

        if (!violationCounts.has(constraint.id)) violationCounts.set(constraint.id, 0);
        violationCounts.set(constraint.id, violationCounts.get(constraint.id) + violations.size());

        if (!view) {
            modelFailures.push({ constraint: constraint, violations: violations });
        } else {
            if (!viewFailures.has(view.id))
                viewFailures.set(view.id, { view: view, path: utils.getViewPath(view), violationCount: 0, failures: [] });

            const report = viewFailures.get(view.id);
            report.violationCount += violations.size();
            const existingFailure = report.failures.find(f => f.constraint.id === constraint.id);
            if (existingFailure) existingFailure.violations.add(violations);
            else report.failures.push({ constraint: constraint, violations: violations });
        }
    }

    // --- CLASSIFY VIEWS ---
    const topLevelViews = _EMPTY.clone();
    const landscapeViews = _EMPTY.clone();
    const objectDomainViews = _EMPTY.clone();
    const valueStreamViews = _EMPTY.clone();
    const valueStreamViewCollections = {};
    const viewMetadata = new Map();

    views.each(view => {
        const covoModel = utils.buildCovoModel($(view).find());
        const topStream = utils.getTopValueStream(covoModel);
        const levels = utils.getLevels(covoModel.elements);
        let viewType;

        if (levels.size === 1 && [...levels][0] === 0) {
            topLevelViews.add(view);
            viewType = 'Top-Level View';
        } else if (topStream) {
            const id = topStream.id;
            if (!valueStreamViewCollections[id]) valueStreamViewCollections[id] = _EMPTY.clone();
            valueStreamViewCollections[id].add(view);
            valueStreamViews.add(view);
            viewType = 'Value Stream View';
        } else if (utils.identifyDomainHeader(covoModel)) {
            objectDomainViews.add(view);
            viewType = 'Object Domain View';
        } else {
            landscapeViews.add(view);
            viewType = 'Landscape View';
        }

        viewMetadata.set(view.id, viewType);
    });

    const valueStageZones = utils.getValueStageZones(valueStreamViews);

    // --- VALIDATE ---
    const globalCovoModel = utils.buildCovoModel(views.find());
    const valueStreamsCovoModel = utils.buildCovoModel(valueStreamViews.find().add(topLevelViews.find()));

    // Global validation
    for (const constraint of constraints.filter(r => ['M01', 'C01', 'C02', 'C03', 'C06', 'C07', 'C08'].includes(r.id)))
        rememberFailures(null, constraint, constraint.validate(globalCovoModel, strict));

    // Validate top-level views
    for (const view of topLevelViews) {
        const covoModel = utils.buildCovoModel($(view).find());
        for (const constraint of constraints.filter(r => ['C04', 'C05', 'C09', 'C10', 'C11', 'C12', 'C13'].includes(r.id)))
            rememberFailures(view, constraint, constraint.validate(covoModel, strict));
    }

    // Validate value stream collections
    for (const [topStreamId, collectionViews] of Object.entries(valueStreamViewCollections)) {
        const extendedViewCollection = topLevelViews.clone().add(collectionViews);
        const covoModel = utils.buildCovoModel(collectionViews.find());
        const covoModelExtended = utils.buildCovoModel(extendedViewCollection.find());

        const viewLevelMap = new Map();
        extendedViewCollection.each(v => viewLevelMap.set(v.id, utils.getMaxLevel(utils.getUniqueConcepts($(v).find('element')))));

        for (const constraint of constraints.filter(r => ['C04', 'C05', 'C09', 'C10', 'C11', 'C12', 'C13'].includes(r.id))) {
            const violations = constraint.validate(['C04', 'C09'].includes(constraint.id) ? covoModelExtended : covoModel, strict);
            violations.each(viol => {
                const violLevel = utils.getLevel(viol);
                const candidateViews = utils.getIntersection($(viol).viewRefs(), extendedViewCollection);
                const selectedView = candidateViews.filter(v => viewLevelMap.get(v.id) === violLevel).first() || candidateViews.first();
                rememberFailures(selectedView, constraint, $(viol));
            });

            // Validate value stream stages
            if (violations.size() === 0 && ['C12', 'C13'].includes(constraint.id))
                for (const stage of valueStageZones.filter(z => z.topStreamId === topStreamId))
                    rememberFailures(stage.view, constraint, constraint.validate(stage.covoModel, strict));
        }
    }

    // Validate object domain views
    for (const domainView of objectDomainViews) {
        const covoModel = utils.buildCovoModel($(domainView).find());

        // Construct reference context
        const domainHeader = utils.identifyDomainHeader(covoModel);
        const headerLevel = utils.getLevel(domainHeader);
        const maxLevel = utils.getMaxLevel(covoModel.objects);
        let domainObjects = $(domainHeader);
        for (let i = 0; i < maxLevel - headerLevel; i++)
            domainObjects = utils.getChildren(domainObjects);
        const domainIsBasedOn = domainObjects.rels().filter(r => r.type !== config.REL_TYPES.isRefinedBy && r.source.type === config.ELEMENT_TYPES.object && r.target.type === config.ELEMENT_TYPES.object); // all rels in the entire model between and with domain objects
        const collectionIsBasedOn = utils.getIntersection(valueStreamsCovoModel.isBasedOn, domainIsBasedOn); // rels scoped back to value stream and top-level views (what you select is what you get)
        const referenceContext = utils.buildCovoModel($(domainHeader).add(collectionIsBasedOn).add(collectionIsBasedOn.ends()));

        for (const constraint of constraints.filter(r => ['V01', 'V02'].includes(r.id)))
            rememberFailures(domainView, constraint, constraint.validate(covoModel, referenceContext));
    }

    // Validate landscape Views
    for (const landscapeView of landscapeViews) {
        const covoModel = utils.buildCovoModel($(landscapeView).find());
        for (const constraint of constraints.filter(r => ['V01', 'V02'].includes(r.id))) 
            rememberFailures(landscapeView, constraint, constraint.validate(covoModel, valueStreamsCovoModel));
    }

    // --- REPORT GENERATION ---
    console.clear();
    console.show();
    console.log('######################################################################');
    console.log('                        COVO VALIDATION REPORT');
    console.log('######################################################################');
    console.log();
    console.log(`OVERALL STATUS: ${violationCounts.size > 0 ? 'FAILED' : 'PASSED'}`);
    console.log();
    console.log('SELECTION:');
    console.log(` - ${strict ? 'AUDIT' : 'CONSTRUCTION'} mode`);
    console.log(` - ${views.size()} views`);
    console.log(` - ${globalCovoModel.elements.size()} elements (${utils.formatType(config.ELEMENT_TYPES.stream)}, ${utils.formatType(config.ELEMENT_TYPES.capability)}, ${utils.formatType(config.ELEMENT_TYPES.object)})`);
    console.log(` - ${globalCovoModel.horizontalRelationships.size()} horizontal relationships`);
    console.log(` - ${globalCovoModel.isRefinedBy.size()} vertical relationships`);
    console.log();

    if (violationCounts.size > 0) {
        console.log('VIOLATION SUMMARY:');
        Array.from(violationCounts).sort((a, b) => a[0].localeCompare(b[0])).forEach(([id, count]) =>
            console.log(` - ${id}: ${count} violation${count > 1 ? 's' : ''}`));
        console.log();
    }

    // Global report
    if (modelFailures.length > 0) {
        console.log();
        console.log('======================================================================');
        console.log(' GLOBAL STRUCTURAL INTEGRITY');
        console.log('======================================================================');
        renderFailures(modelFailures);
    }

    // Per view report (sorted)
    Array.from(viewFailures)
    .sort((a, b) => `${a[1].path} / ${a[1].view.name}`.localeCompare(`${b[1].path} / ${b[1].view.name}`))
    .forEach(([_, viewFailure]) => {
        console.log();
        console.log('======================================================================');
        console.log(` VIEW: ${viewFailure.view.name.toUpperCase()} (${viewFailure.violationCount} violation${viewFailure.violationCount > 1 ? 's' : ''})`);
        console.log(` Type: ${viewMetadata.get(viewFailure.view.id)}`);
        console.log(` Path: ${viewFailure.path}`);
        console.log('======================================================================');
        renderFailures(viewFailure.failures);
    });

    /**
     * Renders failures.
     */
    function renderFailures(failures) {
        failures.sort((a, b) => a.constraint.id.localeCompare(b)).forEach(f => {
            console.log(` [!!] ${f.constraint.id} - ${f.constraint.describe}:`);
            const max = Math.min(config.VIOLATION_EXAMPLES, f.violations.size());
            for (let i = 0; i < max; i++)
                console.log(` - ${utils.formatConcept(f.violations.get(i))}`);
            if (f.violations.size() > config.VIOLATION_EXAMPLES)
                console.log(` - ... and ${f.violations.size() - config.VIOLATION_EXAMPLES} more`);
            console.log();
        });
    }

    console.log();
    console.log(`Validation completed in ${Date.now() - start} ms`);
})();
