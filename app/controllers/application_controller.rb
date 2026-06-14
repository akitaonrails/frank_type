class ApplicationController < ActionController::Base
  before_action :set_locale

  # Only allow modern browsers supporting webp images, web push, badges, import maps, CSS nesting, and CSS :has.
  allow_browser versions: :modern

  # Changes to the importmap will invalidate the etag for HTML responses
  stale_when_importmap_changes

  helper_method :locale_switch_path

  private

  def set_locale
    locale = if params.key?(:locale)
      normalized_locale(params[:locale]) || I18n.default_locale
    else
      normalized_locale(cookies[:locale]) || browser_locale || I18n.default_locale
    end

    I18n.locale = locale
    cookies.permanent[:locale] = { value: locale.to_s, same_site: :lax }
  end

  def browser_locale
    request.headers.fetch("Accept-Language", "")
      .split(",")
      .map { |entry| entry.split(";").first }
      .filter_map { |locale| normalized_locale(locale) }
      .first
  end

  def normalized_locale(locale)
    case locale.to_s.downcase.tr("_", "-")
    when "pt-br"
      :"pt-BR"
    when "en", /^en-/
      :en
    end
  end

  def locale_switch_path(locale)
    query = request.query_parameters.merge(locale: locale.to_s)
    [ request.path, query.to_query ].reject(&:blank?).join("?")
  end
end
