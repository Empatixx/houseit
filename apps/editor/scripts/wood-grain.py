"""Small original neutral grain tile shared by all generated wooden furniture."""
import numpy as np


def wood_pixels(size=256):
    rng=np.random.default_rng(109)
    fx=np.fft.rfftfreq(size)[None,:]
    fy=np.fft.fftfreq(size)[:,None]

    def fibres(across,along):
        noise=rng.normal(0,1,(size,size))
        spectrum=np.fft.rfft2(noise)
        # Anisotropic noise makes irregular long fibres, without repeated sine bands.
        spectrum*=np.exp(-2*np.pi**2*((fx*across)**2+(fy*along)**2))
        field=np.fft.irfft2(spectrum,s=(size,size))
        return (field-field.mean())/max(field.std(),1e-8)

    fine=fibres(.65,13)
    broad=fibres(3.5,35)
    grain=.93+.006*fine+.003*broad+rng.normal(0,.001,(size,size))
    pixels=np.ones((size,size,4))
    pixels[:,:,:3]=np.clip(grain[:,:,None],.90,.96)
    return pixels
