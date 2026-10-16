<script lang="ts" module>
  // An address's shield: a heraldic division and two tinctures read from the address bytes,
  // so the same party is recognisable at a glance across every page. Heraldry's rule of
  // tincture holds: metal on colour, never colour on colour. Recognition only, never proof.
  const METALS = ["#c49a4e", "#f4eedf"]; // or, argent (the flag's gold and cream)
  const COLOURS = ["#15294a", "#2f6b4f", "#8c3a33", "#4f78de"]; // navy, laurel, gules, azure

  // Divisions on a 24 × 28 field; each is the area painted in the second tincture.
  const DIVISIONS = [
    "M12 0h12v28H12z", // per pale
    "M0 13.5h24V28H0z", // per fess
    "M12 0h12v13.5H12zM0 13.5h12V28H0z", // quarterly
    "M0 0h24v28z", // per bend
    "M0 28 12 12l12 16z", // per chevron
    "M0 0h24L12 14zM0 28h24L12 14z", // per saltire
    "M10 0h4v28h-4zM0 10h24v4H0z", // a cross
    "M8.5 0h7v28h-7z", // a pale
    "M0 10h24v6.5H0z", // a fess
    "M0 0h24v9H0z", // a chief
  ];

  export function blazonOf(address: string): { field: string; charge: string; division: string } {
    const hex = address.replace(/^alt:/, "");
    const byte = (i: number) => parseInt(hex.slice(i * 2, i * 2 + 2), 16) || 0;
    const metalField = byte(0) % 2 === 0;
    const metal = METALS[byte(1) % METALS.length] ?? "#c49a4e";
    const colour = COLOURS[byte(2) % COLOURS.length] ?? "#15294a";
    return {
      field: metalField ? metal : colour,
      charge: metalField ? colour : metal,
      division: DIVISIONS[(byte(3) ^ byte(19)) % DIVISIONS.length] ?? "",
    };
  }
</script>

<script lang="ts">
  let { address, size = 20 }: { address: string; size?: number } = $props();
  const uid = $props.id();
  const arms = $derived(blazonOf(address));
  const shield = "M1.5 1.5h21v12c0 6.9-4.6 11.2-10.5 13.3C6.1 24.7 1.5 20.4 1.5 13.5z";
</script>

<svg class="blazon" width={size} height={Math.round((size * 28) / 24)} viewBox="0 0 24 28" aria-hidden="true">
  <clipPath id="b{uid}"><path d={shield} /></clipPath>
  <g clip-path="url(#b{uid})">
    <rect width="24" height="28" fill={arms.field} />
    <path d={arms.division} fill={arms.charge} />
    <path d="M1.5 1.5h21v4h-21z" fill="#fff" opacity="0.12" />
  </g>
  <path d={shield} fill="none" stroke="#e9c784" stroke-width="1.2" stroke-linejoin="round" />
</svg>

<style>
  .blazon {
    display: inline-block;
    flex: none;
    vertical-align: middle;
    filter: drop-shadow(0 1px 1px rgb(3 12 58 / 0.45));
  }
</style>
