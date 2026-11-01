import {wholesalePresentation} from '@/lib/website/wholesale-presentation'
import {getWebsiteSettingsDefaults} from '@/lib/website/default-settings'
import {resolveStorefrontCapabilities} from '@/lib/website/storefront-capabilities'
import {describe,expect,it} from 'vitest'
import {STOREFRONT_STYLE_OPTIONS,STYLE_BY_VERTICAL,getTemplateCompatibility,isStorefrontStyleAvailable,resolveStorefrontStyle} from '@/lib/website/storefront-style'
describe('Wholesale Pro',()=>{
it('is registered',()=>expect(STOREFRONT_STYLE_OPTIONS.some(x=>String(x.value)==='wholesale-pro')).toBe(true))
it.each(Object.keys(STYLE_BY_VERTICAL))('available for %s without modules',businessVertical=>{expect(isStorefrontStyleAvailable('wholesale-pro',{businessVertical,servicesAvailable:false,catalogAvailable:false})).toBe(true);expect(resolveStorefrontStyle('wholesale-pro',businessVertical,{catalogAvailable:false,servicesAvailable:false})).toBe('wholesale-pro')})
it.each(['electronics','hardware','general'])('recommended for %s',businessVertical=>expect(getTemplateCompatibility({storefrontStyle:'wholesale-pro',businessVertical}).isRecommended).toBe(true))
it('preserves auto defaults',()=>{for(const [v,s] of Object.entries(STYLE_BY_VERTICAL))expect(resolveStorefrontStyle('auto',v)).toBe(s)})
it('is not recommended for cosmetics',()=>expect(getTemplateCompatibility({storefrontStyle:'wholesale-pro',businessVertical:'cosmetics'}).isRecommended).toBe(false))
it('does not require or activate modules',()=>expect(getTemplateCompatibility({storefrontStyle:'wholesale-pro',servicesAvailable:false,catalogAvailable:false}).missingModules).toEqual([]))
})
it('does not turn inherited defaults into wholesale claims',()=>{const settings=getWebsiteSettingsDefaults();const caps=resolveStorefrontCapabilities({businessVertical:'general',operatingModel:'retail',effectiveModules:['inventory']});const presentation=wholesalePresentation(settings,caps);expect(presentation.benefits).toBeUndefined();expect(presentation.hero.badge).toBe('');expect(presentation.hero.subtitle).toBe('');settings.hero_content.title='Oferta configurada';expect(wholesalePresentation(settings,caps).hero.title).toBe('Oferta configurada')})
