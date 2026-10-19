<script setup>defineProps({ plain: Boolean, variant: { type: Number, default: 0 } });</script>
<template><svg viewBox="0 0 600 300" role="img" aria-label="Synthetic room illustration" preserveAspectRatio="xMidYMid slice">
  <rect width="600" height="300" :fill="variant === 1 ? '#d9dfda' : '#ede8e1'" />
  <path d="M0 0H600L460 48H178Z" fill="#f5f3ef"/><path d="M178 48H460V217H178Z" :fill="variant === 1 ? '#b6c5bb' : '#d5d1cb'"/>
  <path d="M0 300V244L178 217H460L600 255V300Z" fill="#bca78d"/>
  <path d="M178 217L90 300M250 217L225 300M330 217L370 300M410 217L530 300M0 277H600M70 244H565" stroke="#a38a71" stroke-width="2"/>
  <path d="M220 77H328V177H220Z" fill="#f9fafb"/><path d="M227 84H321V169H227Z" fill="#b2cfd3"/><path d="M227 145L252 123L277 139L304 111L321 131V169H227Z" fill="#839b91"/><path d="M273 82V171M224 125H325" stroke="#f7f7f3" stroke-width="5"/>
  <path v-if="!plain" d="M178 49H459V215H178Z" fill="#7c3aed" fill-opacity=".08" stroke="#8b5cf6" stroke-width="2" stroke-dasharray="6 4"/>
  <rect v-if="!plain" x="189" y="59" width="52" height="22" rx="4" fill="#7540dc"/><text v-if="!plain" x="201" y="74" fill="white" font-size="12" font-family="sans-serif">wall</text>
  <path d="M492 244L501 200H528L537 250Z" fill="#b7a18a"/><path d="M514 211V133M514 167Q478 142 486 123Q518 126 514 167M515 185Q546 157 550 140Q519 142 515 185" stroke="#687f68" stroke-width="7" fill="#687f68"/>
</svg></template>
