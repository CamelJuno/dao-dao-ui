import { themeChange } from 'theme-change'
import { useEffect, useState } from 'react'
import daisyuiThemes from 'styles/daisyui-themes.json'
import { MoonIcon, SunIcon } from '@heroicons/react/outline'

const themes = Object.keys(daisyuiThemes) || ['']
export const defaultTheme = themes[0]

function ThemeToggle() {
  const [theme, setTheme] = useState(defaultTheme)
  useEffect(() => {
    themeChange(false)
    setTheme(
      document.documentElement.getAttribute('data-theme') || defaultTheme
    )
  }, [])

  return (
    <div className="form-control lg:mr-4 md:ml-auto">
      <label className="cursor-pointer label">
        <span className="label-text">
          <SunIcon className="w-6 h-6 mr-1" />
        </span>
        <input
          type="checkbox"
          className="toggle toggle-secondary mx-1"
          data-toggle-theme={themes.join(',')}
          data-act-class="active"
          checked={theme !== themes[0]}
          onClick={() =>
            setTheme(theme !== defaultTheme ? defaultTheme : themes[1])
          }
          readOnly
        />
        <span className="label-text">
          <MoonIcon className="ml-1 w-6 h-6" />
        </span>
      </label>
    </div>
  )
}

export default ThemeToggle
