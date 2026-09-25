// About text. From prod index.html at 9847549, reworked for the help
// dialog: what the markers and levels mean, how to find your way, how to
// share. Version, license, source and credits are added below it.

export default `<p>
    An opinionated, on-prem oriented map of where security happens in a
    Kubernetes cluster: from the people and pipelines that change it,
    through the API server, down to the nodes, pods and network. It is a
    thinking aid for finding controls and gaps, not a checklist or a
    reference architecture.
</p>
<h4>Reading the map</h4>
<ul class="about-list">
    <li><strong>?</strong> markers explain the part they sit on — hover or tap them.</li>
    <li>
        Coloured markers show where to focus first: priority 1 is the most
        important, then 2 and 3. Info markers add background.
    </li>
    <li>The legend in the diagram explains the shapes, the lines and the detail levels.</li>
</ul>
<h4>Finding your way</h4>
<ul class="about-list">
    <li>Scroll or pinch to zoom, drag to pan.</li>
    <li>
        The menu (bottom right) searches every explanation and filters by
        detail level, topic and priority. Start at a low level for the big
        picture and raise it for more.
    </li>
    <li>Pin what matters to you, and add your own notes; both go into the link.</li>
</ul>
<h4>Sharing</h4>
<p>
    The address bar always carries your view — copy it to share exactly what
    you see. Ready-made variants are under <strong>Share</strong>.
</p>
`;
